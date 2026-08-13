import { NextResponse } from "next/server";
import {
  BLOG_FIELD_KEYS,
  BLOG_REQUIRED_FIELDS,
  type CreateBlogJobPayload,
} from "@/lib/api-client/types";
import { getApiMode } from "@/lib/api-client/server/mode";
import { createMockBlogJob } from "@/lib/api-client/server/mock-store";
import {
  errorResponse,
  proxyPendingResponse,
} from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

/**
 * 12필드가 전부 문자열로 와야 하고, 필수 4개는 비어 있지 않아야 한다.
 * 선택 필드는 빈 문자열이 정상 값이므로 존재 여부만 본다(규범님 8/11).
 */
function isPayload(value: unknown): value is CreateBlogJobPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (!BLOG_FIELD_KEYS.every((key) => typeof payload[key] === "string"))
    return false;
  return BLOG_REQUIRED_FIELDS.every(
    (key) => (payload[key] as string).trim().length > 0,
  );
}

export async function POST(request: Request) {
  if (getApiMode() === "proxy") {
    const serverResponse = await proxyPendingResponse(request);

    if (serverResponse.status === 401) {
      console.log("server Response:", serverResponse);
      const { status, statusText } = serverResponse;
      const error = errorResponse(
        status,
        statusText,
        "인증이 만료되었습니다. 로그인해주세요",
      );

      return error;
    }

    return serverResponse;
  }

  const payload = await request.json().catch(() => null);
  if (!isPayload(payload)) {
    return errorResponse(
      422,
      "INVALID_BLOG_INPUT",
      "메인 시술·베이스 컷·디자인 포인트·고객 불편을 확인해주세요.",
    );
  }

  return NextResponse.json(createMockBlogJob(), {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}
