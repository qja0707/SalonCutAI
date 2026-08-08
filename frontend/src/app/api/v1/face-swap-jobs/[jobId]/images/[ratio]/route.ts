import { getApiMode } from "@/lib/api-client/server/mode";
import { getMockFaceSwapJob, mockFaceSwapImage } from "@/lib/api-client/server/mock-store";
import { errorResponse, proxyPendingResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ jobId: string; ratio: string }> };

export async function GET(_request: Request, context: Context) {
  if (getApiMode() === "proxy") return proxyPendingResponse();
  const { jobId, ratio } = await context.params;
  const job = getMockFaceSwapJob(jobId);
  if (!job) return errorResponse(404, "JOB_NOT_FOUND", "작업을 찾을 수 없습니다.");
  if (job.status !== "completed") {
    return errorResponse(409, "JOB_IN_PROGRESS", "이미지 생성이 아직 완료되지 않았습니다.");
  }
  const image = mockFaceSwapImage(jobId, ratio);
  if (!image) return errorResponse(404, "RESULT_NOT_FOUND", "요청한 규격의 결과를 찾을 수 없습니다.");

  return new Response(new TextDecoder().decode(image.bytes), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="${image.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
