import { proxyVideoResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyVideoResponse(request);
}

export async function DELETE(request: Request) {
  return proxyVideoResponse(request);
}
