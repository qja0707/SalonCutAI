import { backendUrl, forwardResponse, unavailableResponse } from "@/lib/api-client/server/backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    const headers = new Headers();
    const range = request.headers.get("range");
    if (range) headers.set("range", range);
    return forwardResponse(await fetch(
      backendUrl(`/api/v1/video-jobs/${encodeURIComponent(jobId)}/video`),
      { cache: "no-store", headers },
    ));
  } catch {
    return unavailableResponse();
  }
}
