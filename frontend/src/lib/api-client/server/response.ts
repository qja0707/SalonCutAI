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

    // 백엔드에서 받은 응답 데이터(Blob)와 Status, Header를 그대로 클라이언트에 반환
    const responseData = await response.blob();

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
