import {
  type SigninPayload,
  type BlogMockScenario,
  type CreateBlogJobPayload,
  type CreateFaceSwapJobPayload,
  type CreateFaceSwapJobResponse,
  type ErrorEnvelope,
  type FaceSwapJobResponse,
  type MockScenario,
  type ReferenceFace,
  type ReferenceFacesResponse,
  type RetryFaceSwapJobResponse,
  SigninResponse,
  BlogWireResult,
} from "@/lib/api-client/types";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | T
    | ErrorEnvelope
    | null;
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? (data as ErrorEnvelope).error.message
        : `요청에 실패했습니다. (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

/** 참조 얼굴 목록. 봉투에서 items 만 꺼내 화면에 넘긴다. */
export async function getReferenceFaces(): Promise<ReferenceFace[]> {
  const response = await parseResponse<ReferenceFacesResponse>(
    await fetch("/api/v1/reference-faces", { cache: "no-store" }),
  );
  return response.items;
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

export async function getFaceSwapJob(
  jobId: string,
): Promise<FaceSwapJobResponse> {
  return parseResponse<FaceSwapJobResponse>(
    await fetch(`/api/v1/face-swap-jobs/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
    }),
  );
}

export async function retryFaceSwapJob(
  jobId: string,
): Promise<RetryFaceSwapJobResponse> {
  return parseResponse<RetryFaceSwapJobResponse>(
    await fetch(`/api/v1/face-swap-jobs/${encodeURIComponent(jobId)}/retry`, {
      method: "POST",
    }),
  );
}

export async function deleteFaceSwapJob(jobId: string): Promise<void> {
  const response = await fetch(
    `/api/v1/face-swap-jobs/${encodeURIComponent(jobId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) await parseResponse<never>(response);
}

export async function createBlogJob(
  payload: CreateBlogJobPayload,
  scenario: BlogMockScenario = "normal",
): Promise<BlogWireResult> {
  return parseResponse<BlogWireResult>(
    await fetch("/api/v1/text-gen/blog-generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Mock-Scenario": scenario,
      },
      body: JSON.stringify(payload),
    }),
  );
}

export async function signin(payload: SigninPayload): Promise<SigninResponse> {
  return parseResponse<SigninResponse>(
    await fetch("/api/v1/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}
