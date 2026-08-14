import {
  backendUrl,
  forwardResponse,
  unavailableResponse,
} from "@/lib/api-client/server/backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(backendUrl("/api/v1/video-captions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    return forwardResponse(response);
  } catch {
    return unavailableResponse();
  }
}
