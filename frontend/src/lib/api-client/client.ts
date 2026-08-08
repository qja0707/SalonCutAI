import type {
  BlogJobResponse,
  BlogMockScenario,
  CreateBlogJobPayload,
  CreateBlogJobResponse,
  CreateFaceSwapJobPayload,
  CreateFaceSwapJobResponse,
  ErrorEnvelope,
  FaceSwapJobResponse,
  MockScenario,
  RetryBlogJobResponse,
  RetryFaceSwapJobResponse,
} from "@/lib/api-client/types";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | ErrorEnvelope | null;
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data
      ? (data as ErrorEnvelope).error.message
      : `요청에 실패했습니다. (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function createFaceSwapJob(
  image: File,
  payload: CreateFaceSwapJobPayload,
  scenario: MockScenario = "normal",
): Promise<CreateFaceSwapJobResponse> {
  const form = new FormData();
  form.append("image", image);
  form.append("payload", JSON.stringify(payload));

  return parseResponse<CreateFaceSwapJobResponse>(
    await fetch("/api/v1/face-swap-jobs", {
      method: "POST",
      headers: { "X-Mock-Scenario": scenario },
      body: form,
    }),
  );
}

export async function getFaceSwapJob(jobId: string): Promise<FaceSwapJobResponse> {
  return parseResponse<FaceSwapJobResponse>(
    await fetch(`/api/v1/face-swap-jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" }),
  );
}

export async function retryFaceSwapJob(jobId: string): Promise<RetryFaceSwapJobResponse> {
  return parseResponse<RetryFaceSwapJobResponse>(
    await fetch(`/api/v1/face-swap-jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST" }),
  );
}

export async function deleteFaceSwapJob(jobId: string): Promise<void> {
  const response = await fetch(`/api/v1/face-swap-jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
  if (!response.ok) await parseResponse<never>(response);
}

export async function createBlogJob(
  payload: CreateBlogJobPayload,
  scenario: BlogMockScenario = "normal",
): Promise<CreateBlogJobResponse> {
  return parseResponse<CreateBlogJobResponse>(
    await fetch("/api/v1/blog-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Mock-Scenario": scenario },
      body: JSON.stringify(payload),
    }),
  );
}

export async function getBlogJob(jobId: string): Promise<BlogJobResponse> {
  return parseResponse<BlogJobResponse>(
    await fetch(`/api/v1/blog-jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" }),
  );
}

export async function retryBlogJob(jobId: string): Promise<RetryBlogJobResponse> {
  return parseResponse<RetryBlogJobResponse>(
    await fetch(`/api/v1/blog-jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST" }),
  );
}

export async function deleteBlogJob(jobId: string): Promise<void> {
  const response = await fetch(`/api/v1/blog-jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
  if (!response.ok) await parseResponse<never>(response);
}
