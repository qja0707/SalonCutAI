import { proxyPendingResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyPendingResponse(request);
}

export async function DELETE(request: Request) {
  return proxyPendingResponse(request);
}
