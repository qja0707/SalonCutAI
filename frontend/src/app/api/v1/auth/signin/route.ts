import { getApiMode } from "@/lib/api-client/server/mode";
import { proxyPendingResponse } from "@/lib/api-client/server/response";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (getApiMode() === "proxy") return proxyPendingResponse(request);

  return NextResponse.json({
    status: 200,
    body: {
      access_token: "test_access_token",
      refresh_token: "test_refresh_token",
    },
  });
}
