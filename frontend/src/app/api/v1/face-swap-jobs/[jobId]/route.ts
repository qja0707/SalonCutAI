import { NextResponse } from "next/server";
import { getApiMode } from "@/lib/api-client/server/mode";
import { deleteMockFaceSwapJob, getMockFaceSwapJob } from "@/lib/api-client/server/mock-store";
import { errorResponse, proxyPendingResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: Context) {
  if (getApiMode() === "proxy") return proxyPendingResponse();
  const { jobId } = await context.params;
  const job = getMockFaceSwapJob(jobId);
  if (!job) return errorResponse(404, "JOB_NOT_FOUND", "작업을 찾을 수 없습니다.");
  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, context: Context) {
  if (getApiMode() === "proxy") return proxyPendingResponse();
  const { jobId } = await context.params;
  const job = getMockFaceSwapJob(jobId);
  if (!job) return errorResponse(404, "JOB_NOT_FOUND", "작업을 찾을 수 없습니다.");
  if (job.status === "queued" || job.status === "processing") {
    return errorResponse(409, "JOB_IN_PROGRESS", "진행 중인 작업은 삭제할 수 없습니다.");
  }
  deleteMockFaceSwapJob(jobId);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
