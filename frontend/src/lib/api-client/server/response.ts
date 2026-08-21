import "server-only";
import { cookies } from "next/headers";

import { NextResponse } from "next/server";
import type { ErrorEnvelope } from "@/lib/api-client/types";
import { ACCESS_TOKEN_EXPIRE_MS, REFRESH_TOKEN_EXPIRE_MS } from "@/constants";

interface TokenRefresh {
  access_token: string;
  refresh_token: string;
}

export function requestId(): string {
  return `req-${crypto.randomUUID()}`;
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  retryable = false,
): NextResponse<ErrorEnvelope> {
  return NextResponse.json(
    { error: { code, message, retryable }, request_id: requestId() },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

const refreshPromises = new Map<string, Promise<TokenRefresh | null>>();

type ProxyFailure = {
  status: number;
  code: string;
  message: string;
};

const VIDEO_PROXY_FAILURE: ProxyFailure = {
  status: 503,
  code: "VIDEO_BACKEND_UNAVAILABLE",
  message: "영상 처리 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
};

// 백엔드에 토큰 재발급을 요청하는 함수
async function fetchNewAccessToken(
  refreshToken: string,
): Promise<TokenRefresh | null> {
  try {
    const response = await fetch(
      `${process.env.BACKEND_API_URL}/api/v1/auth/token-refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data; // 새로 발급된 엑세스 토큰 리턴
  } catch (error) {
    console.error("Token refresh failed:", error);
    return null;
  }
}

export async function proxyPendingResponse(
  req: Request,
  failure?: ProxyFailure,
): Promise<NextResponse> {
  const backendUrl = process.env.BACKEND_API_URL;

  const { pathname, search } = new URL(req.url);
  const targetUrl = `${backendUrl}${pathname}${search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  const refreshToken = cookieStore.get("refreshToken")?.value;

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  try {
    // GET/HEAD 요청은 body가 없어야 함
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const body = hasBody ? req.body : undefined;
    const requestInit: RequestInit & { duplex?: "half" } = {
      method: req.method,
      headers,
      body,
      cache: "no-store", // 프록시 요청 캐시 방지
    };
    if (body) requestInit.duplex = "half";

    let response = await fetch(targetUrl, requestInit);

    let detail: string | undefined;
    if (response.status === 401) {
      try {
        const errorData = await response.clone().json();
        detail = errorData?.detail;
      } catch {
        // json 파싱 실패 시 무시
      }
    }

    // 백엔드에서 401 Unauthorized (토큰 만료)가 내려온 경우
    if (detail === "토큰이 만료되었습니다." && refreshToken) {
      // 다른 동시 요청이 이미 재발급을 진행 중인지 확인합니다.
      let refreshPromise = refreshPromises.get(refreshToken);

      if (!refreshPromise) {
        // 내가 첫 번째로 에러를 맞닥뜨린 요청이라면, 실제 백엔드에 리프레시 요청을 보냅니다.
        refreshPromise = fetchNewAccessToken(refreshToken).finally(() => {
          // 재발급이 끝나면 락(Lock)을 해제하기 위해 Map에서 삭제합니다.
          setTimeout(() => {
            refreshPromises.delete(refreshToken);
          }, 500);
        });

        // 생성한 프로미스를 Map에 등록하여 다른 동시 요청들이 공유할 수 있게 합니다.
        refreshPromises.set(refreshToken, refreshPromise);
      } else {
        console.log(
          `[대기] 이미 다른 요청이 토큰을 갱신 중입니다. 결과를 기다립니다: ${pathname}`,
        );
      }

      // 첫 번째 요청이든, 대기 중이던 요청이든 모두 '동일한 프로미스 결과'를 await 합니다.
      const refreshResult = await refreshPromise;

      if (refreshResult) {
        const { access_token, refresh_token } = refreshResult;

        const isSecure = process.env.NODE_ENV === "production";

        cookieStore.set("accessToken", access_token, {
          maxAge: ACCESS_TOKEN_EXPIRE_MS / 1000,
          secure: isSecure,
          sameSite: isSecure ? "strict" : "lax",
        });
        cookieStore.set("refreshToken", refresh_token, {
          maxAge: REFRESH_TOKEN_EXPIRE_MS / 1000,
          secure: isSecure,
          sameSite: isSecure ? "strict" : "lax",
        });

        // 성공적으로 갱신된 새로운 토큰으로 헤더를 교체하고 백엔드에 '재요청'을 보냅니다.
        headers.set("Authorization", `Bearer ${access_token}`);

        response = await fetch(targetUrl, {
          method: req.method,
          headers,
          body,
          cache: "no-store",
        });
      } else {
        // 리프레시 토큰마저 만료되었거나 에러가 났다면 로그아웃 응답 처리
        cookieStore.delete("accessToken");
        cookieStore.delete("refreshToken");
        return errorResponse(
          401,
          "UNAUTHORIZED",
          "인증 세션이 만료되었습니다. 다시 로그인 해주세요.",
        );
      }
    }

    // 204·205·304 응답은 Fetch 표준상 body가 없어야 하므로 null로 전달
    const responseData = [204, 205, 304].includes(response.status)
      ? null
      : response.body;

    return new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    // 원인은 서버 로그에만 남긴다. 예외 문자열을 그대로 내보내면
    // `TypeError: fetch failed` 같은 영문이 사용자 화면까지 올라간다.
    console.error("[proxy] 백엔드 요청 실패", error);
    const resolvedFailure = failure ?? {
      status: 500,
      code: "INTERNAL_ERROR",
      message: "서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.",
    };
    return errorResponse(
      resolvedFailure.status,
      resolvedFailure.code,
      resolvedFailure.message,
      true,
    );
  }
}

export function proxyVideoResponse(req: Request): Promise<NextResponse> {
  return proxyPendingResponse(req, VIDEO_PROXY_FAILURE);
}
