import { backendUrl, forwardResponse, unavailableResponse } from "@/lib/api-client/server/backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const response = await fetch(backendUrl("/api/v1/video-jobs"), {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    return forwardResponse(response);
  } catch {
    return unavailableResponse();
  }
}
