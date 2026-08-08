import "server-only";

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

export function proxyPendingResponse(): NextResponse<ErrorEnvelope> {
  return errorResponse(500, "INTERNAL_ERROR", "VM 연동을 준비하고 있습니다. 잠시 후 다시 시도해주세요.", true);
}
