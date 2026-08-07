import { NextResponse } from "next/server";
import { getApiMode } from "@/lib/api-client/server/mode";
import { retryMockJob } from "@/lib/api-client/server/mock-store";
import { errorResponse, proxyPendingResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  if (getApiMode() === "proxy") return proxyPendingResponse();
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as { components?: unknown } | null;
  const components = Array.isArray(body?.components)
    ? body.components.filter((value): value is "image" | "blog" => value === "image" || value === "blog")
    : [];

  const result = retryMockJob(jobId, components);
  if (result.reason === "missing") return errorResponse(404, "JOB_NOT_FOUND", "작업을 찾을 수 없습니다.");
  if (result.reason === "not-retryable" || !result.response) {
    return errorResponse(409, "NOT_RETRYABLE", "현재 상태에서는 다시 시도할 수 없습니다.");
  }
  return NextResponse.json(result.response, { status: 202, headers: { "Cache-Control": "no-store" } });
}
