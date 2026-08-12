import { NextResponse } from "next/server";
import { getApiMode } from "@/lib/api-client/server/mode";
import { listMockReferenceFaces } from "@/lib/api-client/server/mock-store";
import { proxyPendingResponse, requestId } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

/** 참조 얼굴 목록. job 과 무관한 정적 목록이라 화면에서 한 번만 불러온다. */
export async function GET(request: Request) {
  if (getApiMode() === "proxy") return proxyPendingResponse(request);

  return NextResponse.json(
    { items: listMockReferenceFaces(), request_id: requestId() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
