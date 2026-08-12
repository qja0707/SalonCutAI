import { backendUrl, forwardResponse, unavailableResponse } from "@/lib/api-client/server/backend";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    return forwardResponse(
      await fetch(backendUrl(`/api/v1/video-jobs/${encodeURIComponent(jobId)}`), {
        cache: "no-store",
      }),
    );
  } catch {
    return unavailableResponse();
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    return forwardResponse(
      await fetch(backendUrl(`/api/v1/video-jobs/${encodeURIComponent(jobId)}`), {
        method: "DELETE",
        cache: "no-store",
      }),
    );
  } catch {
    return unavailableResponse();
  }
}
