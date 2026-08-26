import { getApiMode } from "@/lib/api-client/server/mode";
import { proxyPendingResponse } from "@/lib/api-client/server/response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (getApiMode() === "proxy") return proxyPendingResponse(request);

  return NextResponse.json(
    { id: "testuser" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
