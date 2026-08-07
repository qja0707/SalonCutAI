import { NextResponse } from "next/server";
import type { CreateJobPayload } from "@/lib/api-client/types";
import { getApiMode } from "@/lib/api-client/server/mode";
import { createMockJob, parseMockScenario } from "@/lib/api-client/server/mock-store";
import { errorResponse, proxyPendingResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function isPayload(value: unknown): value is CreateJobPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<CreateJobPayload>;
  return (
    payload.consent?.agreed === true &&
    typeof payload.consent.consent_version === "string" &&
    Boolean(payload.blog_input) &&
    Array.isArray(payload.options?.ratios)
  );
}

export async function POST(request: Request) {
  if (getApiMode() === "proxy") {
    // TODO(MOCK-001 후속): 인증·HTTPS가 준비된 VM API 프록시를 이 경계에 연결한다.
    return proxyPendingResponse();
  }

  const form = await request.formData().catch(() => null);
  if (!form) return errorResponse(422, "INVALID_BLOG_INPUT", "생성 정보를 확인해주세요.");

  const image = form.get("image");
  const payloadText = form.get("payload");
  if (!(image instanceof File)) return errorResponse(400, "INVALID_IMAGE_TYPE", "JPG, PNG 또는 WEBP 사진을 사용해주세요.");
  if (typeof payloadText !== "string") return errorResponse(422, "INVALID_BLOG_INPUT", "블로그 생성 정보를 확인해주세요.");
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return errorResponse(400, "INVALID_IMAGE_TYPE", "JPG, PNG 또는 WEBP 사진을 사용해주세요.");
  }
  if (image.size > MAX_UPLOAD_BYTES) {
    return errorResponse(413, "IMAGE_TOO_LARGE", "사진 용량은 10MB 이하로 줄여주세요.");
  }

  const payload = await Promise.resolve().then(() => JSON.parse(payloadText) as unknown).catch(() => null);
  if (!payload || typeof payload !== "object" || (payload as Partial<CreateJobPayload>).consent?.agreed !== true) {
    return errorResponse(400, "CONSENT_REQUIRED", "사진 활용 동의를 확인해주세요.");
  }
  if (!isPayload(payload)) return errorResponse(422, "INVALID_BLOG_INPUT", "블로그 생성 정보를 확인해주세요.");

  const scenario = parseMockScenario(request.headers.get("X-Mock-Scenario"));
  return NextResponse.json(createMockJob(scenario), {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}
