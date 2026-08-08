import { NextResponse } from "next/server";
import { BLOG_TONES, type CreateBlogJobPayload } from "@/lib/api-client/types";
import { getApiMode } from "@/lib/api-client/server/mode";
import { createMockBlogJob, parseBlogMockScenario } from "@/lib/api-client/server/mock-store";
import { errorResponse, proxyPendingResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

const ALLOWED_TONES = new Set<string>(BLOG_TONES);

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isPayload(value: unknown): value is CreateBlogJobPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<CreateBlogJobPayload>;
  return (
    typeof payload.topic === "string" &&
    payload.topic.trim().length > 0 &&
    typeof payload.tone === "string" &&
    ALLOWED_TONES.has(payload.tone) &&
    isOptionalString(payload.theme) &&
    isOptionalString(payload.domainContext)
  );
}

export async function POST(request: Request) {
  if (getApiMode() === "proxy") return proxyPendingResponse();

  const payload = await request.json().catch(() => null);
  if (!isPayload(payload)) {
    return errorResponse(422, "INVALID_BLOG_INPUT", "글감과 톤 앤 매너를 확인해주세요.");
  }

  const scenario = parseBlogMockScenario(request.headers.get("X-Mock-Scenario"));
  return NextResponse.json(createMockBlogJob(payload, scenario), {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}
