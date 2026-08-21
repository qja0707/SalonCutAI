import { proxyVideoResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return proxyVideoResponse(request);
}
