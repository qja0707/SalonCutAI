import { getApiMode } from "@/lib/api-client/server/mode";
import { proxyPendingResponse } from "@/lib/api-client/server/response";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export function GET(_request: Request) {
  if (getApiMode() === "proxy"){
    return proxyPendingResponse(_request)
  }

  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
