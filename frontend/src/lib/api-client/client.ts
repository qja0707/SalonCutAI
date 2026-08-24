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
  type CreateVideoJobResponse,
  type VideoCaptionClip,
  type VideoClipOptions,
  type VideoCaptionResponse,
  type VideoJobResponse,
  type SigninResponse,
  type BlogWireResult,
} from "@/lib/api-client/types";

/**
 * 응답 실패를 상태 코드까지 실어서 던진다.
 * 저장해둔 job 을 복구할 때 "서버에서 사라진 작업(404)"과 "지금 통신이 안 되는 것"을
 * 갈라야 하는데, 메시지 문자열만으로는 구분할 수 없었다.
 * 기존 호출부는 error.message 만 쓰므로 그대로 동작한다.
 */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

/** 지워졌거나 애초에 없는 job. 복구를 포기하고 저장분을 버리면 되는 경우다. */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | T
    | ErrorEnvelope
    | null;
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? (data as ErrorEnvelope).error.message
        : data &&
            typeof data === "object" &&
            "detail" in data &&
            typeof data.detail === "string"
          ? data.detail
          : `요청에 실패했습니다. (${response.status})`;
    throw new ApiRequestError(message, response.status);
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
export async function createVideoJob(
  clips: { file: File; options: VideoClipOptions }[],
  blurFaces = true,
): Promise<CreateVideoJobResponse> {
  const form = new FormData();
  for (const clip of clips) form.append("clips", clip.file);
  form.append(
    "payload",
    JSON.stringify({ clips: clips.map((clip) => clip.options), blur_faces: blurFaces }),
  );
  return parseResponse<CreateVideoJobResponse>(
    await fetch("/api/v1/video-jobs", { method: "POST", body: form }),
  );
}

export async function getVideoJob(jobId: string): Promise<VideoJobResponse> {
  return parseResponse<VideoJobResponse>(
    await fetch(`/api/v1/video-jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" }),
  );
}

export async function deleteVideoJob(jobId: string): Promise<void> {
  const response = await fetch(`/api/v1/video-jobs/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
  });
  if (!response.ok) await parseResponse<never>(response);
}

export function videoJobUrl(jobId: string): string {
  return `/api/v1/video-jobs/${encodeURIComponent(jobId)}/video`;
}

export async function createVideoCaptions(
  clips: VideoCaptionClip[],
  topic: string,
): Promise<VideoCaptionResponse> {
  return parseResponse<VideoCaptionResponse>(
    await fetch("/api/v1/video-captions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clips, topic }),
    }),
  );
}
