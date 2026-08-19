import { proxyPendingResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return proxyPendingResponse(request);
}
