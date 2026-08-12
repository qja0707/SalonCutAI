import { getApiMode } from "@/lib/api-client/server/mode";
import { mockReferenceFaceThumbnail } from "@/lib/api-client/server/mock-store";
import { errorResponse, proxyPendingResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ faceId: string }> };

export async function GET(_request: Request, context: Context) {
  if (getApiMode() === "proxy") return proxyPendingResponse();
  const { faceId } = await context.params;
  const thumbnail = mockReferenceFaceThumbnail(faceId);
  if (!thumbnail) return errorResponse(404, "REFERENCE_FACE_NOT_FOUND", "참조 얼굴을 찾을 수 없습니다.");

  return new Response(new TextDecoder().decode(thumbnail.bytes), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="${thumbnail.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
