import "server-only";
import { cookies } from "next/headers";

import { NextResponse } from "next/server";
import type { ErrorEnvelope } from "@/lib/api-client/types";

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

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  try {
    // GET/HEAD 요청은 body가 없어야 함
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const body = hasBody ? await req.blob() : undefined;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store", // 프록시 요청 캐시 방지
    });

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
    // 원인은 서버 로그에만 남긴다. 예외 문자열을 그대로 내보내면
    // `TypeError: fetch failed` 같은 영문이 사용자 화면까지 올라간다.
    console.error("[proxy] 백엔드 요청 실패", error);
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.",
      true,
    );
  }
}
