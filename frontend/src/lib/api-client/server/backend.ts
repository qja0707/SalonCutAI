import "server-only";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

export function backendUrl(path: string): string {
  const base = (process.env.SALON_API_BASE_URL || DEFAULT_BACKEND_URL).replace(/\/$/, "");
  return `${base}${path}`;
}

export async function forwardResponse(response: Response): Promise<Response> {
  const headers = new Headers();
  for (const name of [
    "content-type",
    "content-disposition",
    "content-length",
    "accept-ranges",
    "content-range",
  ]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers });
}

export function unavailableResponse(): Response {
  return Response.json(
    {
      error: {
        code: "VIDEO_BACKEND_UNAVAILABLE",
        message: "영상 처리 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
        retryable: true,
      },
      request_id: `req-${crypto.randomUUID()}`,
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
