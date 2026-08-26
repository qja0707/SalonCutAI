import { getApiMode } from "@/lib/api-client/server/mode";
import { proxyPendingResponse } from "@/lib/api-client/server/response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (getApiMode() === "proxy") return proxyPendingResponse(request);

  return NextResponse.json(
    {
      id: "testuser",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
