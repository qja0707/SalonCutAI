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

/**
 * 로그인하지 않은 상태로도 부르는 경로. 여기서 나온 401 은 "세션이 만료됐다"가 아니라
 * "방금 시도한 인증이 틀렸다"는 뜻이라 재발급 대상이 아니다 — 비밀번호를 틀렸을 뿐인데
 * 이전 세션의 refreshToken 을 굴려 토큰을 회전시키게 된다(#193 리뷰).
 */
const PUBLIC_AUTH_PATHS = [
  "/api/v1/auth/signin",
  "/api/v1/auth/token-refresh",
];

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

/**
 * refreshToken 으로 세션을 갱신하고 쿠키를 새로 심는다. 실패하면 남은 쿠키를 지우고
 * null 을 돌려준다.
 *
 * 프록시의 401 자동 갱신과 명시적 갱신 라우트(`/api/v1/auth/token-refresh`)가 같은
 * 락(`refreshPromises`)을 공유해야, 같은 refreshToken 으로 두 번 회전시키지 않는다.
 */
export async function refreshSessionCookies(): Promise<TokenRefresh | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refreshToken")?.value;
  if (!refreshToken) return null;

  let refreshPromise = refreshPromises.get(refreshToken);
  if (!refreshPromise) {
    refreshPromise = fetchNewAccessToken(refreshToken).finally(() => {
      setTimeout(() => {
        refreshPromises.delete(refreshToken);
      }, 500);
    });
    refreshPromises.set(refreshToken, refreshPromise);
  } else {
    console.log("[대기] 이미 다른 요청이 토큰을 갱신 중입니다. 결과를 기다립니다.");
  }

  const result = await refreshPromise;
  if (!result) {
    // 리프레시 토큰마저 만료되었거나 에러가 난 경우다.
    cookieStore.delete("accessToken");
    cookieStore.delete("refreshToken");
    return null;
  }

  const isSecure = process.env.NODE_ENV === "production";
  cookieStore.set("accessToken", result.access_token, {
    maxAge: ACCESS_TOKEN_EXPIRE_MS / 1000,
    secure: isSecure,
    sameSite: isSecure ? "strict" : "lax",
  });
  cookieStore.set("refreshToken", result.refresh_token, {
    maxAge: REFRESH_TOKEN_EXPIRE_MS / 1000,
    secure: isSecure,
    sameSite: isSecure ? "strict" : "lax",
  });
  return result;
}

export async function proxyPendingResponse(
  req: Request,
  failure?: ProxyFailure,
  isStream = false,
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
    let requestBody = undefined;

    if (hasBody) {
      if (isStream) {
        requestBody = req.body;
      } else {
        requestBody = await req.arrayBuffer(); // req.body 스트림을 읽어 메모리에 고정
      }
    }

    const requestInit: RequestInit & { duplex?: "half" } = {
      method: req.method,
      headers,
      body: requestBody,
      cache: "no-store", // 프록시 요청 캐시 방지
    };
    if (hasBody) requestInit.duplex = "half";

    let response = await fetch(targetUrl, requestInit);

    let detail: string | undefined;
    if (response.status === 401) {
      try {
        const errorData = await response.clone().json();
        detail = errorData?.detail;
      } catch (e) {
        // json 파싱 실패 시 무시
        console.debug("[프록시] 401 에러 바디 파싱 실패:", e);
      }
    }

    /*
      401 이고 refreshToken 이 남아 있으면 재발급을 시도한다.

      전에는 백엔드 문구가 정확히 "토큰이 만료되었습니다." 일 때만 갱신했는데,
      accessToken **쿠키 자체가 만료돼 사라진** 경우에는 Authorization 헤더가 붙지
      않아 FastAPI 기본 문구인 "Not authenticated" 가 내려온다 — 조건에서 빠져 갱신
      없이 401 이 그대로 나갔다. accessToken 30분 / refreshToken 7일 설정이라
      30분만 지나면 늘 이 상태가 되고, 그러면 7일짜리 refreshToken 이 무의미해진다.
      문구 비교는 백엔드 메시지가 바뀌면 조용히 깨지기도 해서 상태 코드로 판정한다.
    */
    const isPublicAuthPath = PUBLIC_AUTH_PATHS.some((path) =>
      pathname.startsWith(path),
    );
    if (response.status === 401 && refreshToken && !isPublicAuthPath) {
      console.debug(
        `[프록시] 401(${detail ?? "detail 없음"}) — 토큰 재발급을 시도합니다: ${pathname}`,
      );
      if (isStream && hasBody) {
        console.warn(
          `[프록시] 대용량 스트림 요청 중 토큰 만료 발생. 내부 재시도가 불가능하므로 401을 그대로 반환합니다: ${pathname}`,
        );
        return errorResponse(
          401,
          "UNAUTHORIZED",
          "인증 세션이 만료되었습니다. 다시 시도해주세요.",
        );
      }
      const refreshResult = await refreshSessionCookies();

      if (refreshResult) {
        // 성공적으로 갱신된 새로운 토큰으로 헤더를 교체하고 백엔드에 '재요청'을 보냅니다.
        headers.set("Authorization", `Bearer ${refreshResult.access_token}`);

        response = await fetch(targetUrl, {
          method: req.method,
          headers,
          body: requestBody,
          cache: "no-store",
        });
      } else {
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

export function proxyVideoResponse(
  req: Request,
  isStream = true,
): Promise<NextResponse> {
  return proxyPendingResponse(req, VIDEO_PROXY_FAILURE, isStream);
}
