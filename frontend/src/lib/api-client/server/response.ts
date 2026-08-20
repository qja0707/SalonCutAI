import "server-only";
import { cookies } from "next/headers";

import { NextResponse } from "next/server";
import type { ErrorEnvelope } from "@/lib/api-client/types";

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
    const body = hasBody ? await req.blob() : undefined;

    // 첫 번째 백엔드 요청 시도
    let response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });

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
          refreshPromises.delete(refreshToken);
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

        cookieStore.set("accessToken", access_token);
        cookieStore.set("refreshToken", refresh_token);

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
      : await response.blob();

    return new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.log(error);
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      error ? String(error) : "알 수 없는 오류",
      true,
    );
  }
}
