import "server-only";

import type {
  ApiError,
  BlogJobWireResponse,
  BlogMockScenario,
  BlogWireResult,
  CreateBlogJobPayload,
  CreateBlogJobResponse,
  CreateFaceSwapJobResponse,
  FaceSwapJobResponse,
  JobStatus,
  MockScenario,
  Ratio,
  ReferenceFace,
  RetryBlogJobResponse,
  RetryFaceSwapJobResponse,
} from "@/lib/api-client/types";
import { requestId } from "@/lib/api-client/server/response";

type StoredFaceSwapJob = {
  id: string;
  testCode: string;
  scenario: MockScenario;
  createdAtMs: number;
  consentRecordedAt: string;
  attempt: number;
  retryAtMs: number | null;
  retried: boolean;
};

type StoredBlogJob = {
  id: string;
  testCode: string;
  scenario: BlogMockScenario;
  payload: CreateBlogJobPayload;
  createdAtMs: number;
  attempt: number;
  retryAtMs: number | null;
  retried: boolean;
};

type GlobalMockStore = typeof globalThis & {
  __salonFaceSwapMockJobs?: Map<string, StoredFaceSwapJob>;
  __salonBlogMockJobs?: Map<string, StoredBlogJob>;
};

const store = globalThis as GlobalMockStore;
const jobs = store.__salonFaceSwapMockJobs ?? new Map<string, StoredFaceSwapJob>();
store.__salonFaceSwapMockJobs = jobs;
const blogJobs = store.__salonBlogMockJobs ?? new Map<string, StoredBlogJob>();
store.__salonBlogMockJobs = blogJobs;

const IMAGE_DONE_MS = 14_000;
const BLOG_DONE_MS = 14_000;
const QUEUED_MS = 2_000;
const TTL_MS = 24 * 60 * 60 * 1_000;

function iso(timeMs: number): string {
  return new Date(timeMs).toISOString();
}

function scale(job: StoredFaceSwapJob): number {
  return job.scenario === "slow" ? 5 : 1;
}

function elapsed(job: StoredFaceSwapJob, nowMs: number): number {
  return nowMs - (job.retryAtMs ?? job.createdAtMs);
}

function jobStatus(job: StoredFaceSwapJob, nowMs: number): JobStatus {
  const elapsedMs = elapsed(job, nowMs);
  if (job.retryAtMs === null && elapsedMs < QUEUED_MS * scale(job)) return "queued";
  if (elapsedMs < IMAGE_DONE_MS * scale(job)) return "processing";
  if (!job.retried && (job.scenario === "image-fail" || job.scenario === "face-not-detected")) return "failed";
  return "completed";
}

function jobError(job: StoredFaceSwapJob, status: JobStatus): ApiError | null {
  if (status !== "failed") return null;
  if (job.scenario === "face-not-detected") {
    return {
      code: "FACE_NOT_DETECTED",
      message: "얼굴을 찾지 못했습니다. 정면에 가까운 사진으로 다시 시도해주세요.",
      retryable: false,
    };
  }
  return {
    code: "IMAGE_GENERATION_FAILED",
    message: "얼굴 교체 이미지 생성에 실패했습니다. 다시 시도해주세요.",
    retryable: true,
  };
}

function imageResults(jobId: string): Record<Ratio, { url: string; format_mode: "crop" | "fit_pad" }> {
  return {
    "1:1": { url: `/api/v1/face-swap-jobs/${jobId}/images/1x1`, format_mode: "crop" },
    "4:5": { url: `/api/v1/face-swap-jobs/${jobId}/images/4x5`, format_mode: "crop" },
    "9:16": { url: `/api/v1/face-swap-jobs/${jobId}/images/9x16`, format_mode: "fit_pad" },
  };
}

export function createMockFaceSwapJob(scenario: MockScenario): CreateFaceSwapJobResponse {
  const nowMs = Date.now();
  const id = `face-${crypto.randomUUID()}`;
  const job: StoredFaceSwapJob = {
    id,
    testCode: `T-${Math.floor(1_000 + Math.random() * 9_000)}`,
    scenario,
    createdAtMs: nowMs,
    consentRecordedAt: iso(nowMs),
    attempt: 1,
    retryAtMs: null,
    retried: false,
  };
  jobs.set(id, job);

  return {
    job_id: id,
    test_code: job.testCode,
    status: "queued",
    created_at: iso(nowMs),
    request_id: requestId(),
  };
}

export function getMockFaceSwapJob(jobId: string): FaceSwapJobResponse | null {
  const job = jobs.get(jobId);
  if (!job) return null;

  const nowMs = Date.now();
  const status = jobStatus(job, nowMs);
  const done = status === "completed";

  return {
    job_id: job.id,
    test_code: job.testCode,
    status,
    attempt: job.attempt,
    queue_position: status === "queued" ? 1 : null,
    results: done ? imageResults(job.id) : null,
    meta: done ? { seed: 42, gen_sec: IMAGE_DONE_MS / 1_000 } : null,
    error: jobError(job, status),
    consent_recorded_at: job.consentRecordedAt,
    created_at: iso(job.createdAtMs),
    updated_at: iso(nowMs),
    source_expires_at: iso(job.createdAtMs + TTL_MS),
    result_expires_at: iso(job.createdAtMs + TTL_MS),
    request_id: requestId(),
  };
}

export function retryMockFaceSwapJob(
  jobId: string,
): { response: RetryFaceSwapJobResponse | null; reason: "missing" | "not-retryable" | null } {
  const job = jobs.get(jobId);
  if (!job) return { response: null, reason: "missing" };

  const current = getMockFaceSwapJob(jobId);
  if (current?.status !== "failed" || !current.error?.retryable) {
    return { response: null, reason: "not-retryable" };
  }

  job.attempt += 1;
  job.retryAtMs = Date.now();
  job.retried = true;
  return {
    response: {
      job_id: job.id,
      status: "processing",
      attempt: job.attempt,
      request_id: requestId(),
    },
    reason: null,
  };
}

export function deleteMockFaceSwapJob(jobId: string): boolean {
  return jobs.delete(jobId);
}

export function parseMockScenario(value: string | null): MockScenario {
  if (value === "image-fail" || value === "face-not-detected" || value === "slow") return value;
  return "normal";
}

export function mockFaceSwapImage(jobId: string, ratio: string): { bytes: Uint8Array; filename: string } | null {
  if (!jobs.has(jobId)) return null;
  const dimensions: Record<string, [number, number, string]> = {
    "1x1": [600, 600, "1:1 · crop"],
    "4x5": [600, 750, "4:5 · crop"],
    "9x16": [540, 960, "9:16 · fit_pad"],
  };
  const config = dimensions[ratio];
  if (!config) return null;
  const [width, height, label] = config;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f5d8cf"/><stop offset="1" stop-color="#d9c2ef"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${width / 2}" cy="${height * 0.38}" r="${width * 0.2}" fill="#f4c9b4"/><path d="M${width * 0.27} ${height * 0.42} Q${width * 0.5} ${height * 0.08} ${width * 0.73} ${height * 0.42} L${width * 0.68} ${height * 0.68} Q${width * 0.5} ${height * 0.75} ${width * 0.32} ${height * 0.68}Z" fill="#342d35" opacity=".92"/><text x="50%" y="88%" text-anchor="middle" font-family="sans-serif" font-size="${Math.max(18, width * 0.04)}" fill="#4b3d50">MOCK ${label}</text></svg>`;
  return { bytes: new TextEncoder().encode(svg), filename: `salon-${ratio}-mock.svg` };
}

/**
 * 참조 얼굴 풀(조합 3). 수민님 쪽은 8/11 기준 2장이고, 화면이 늘어난 상황도 견디는지
 * 보려고 mock 은 6장으로 둔다. gender·ethnicity·age_group 은 face-taxonomy 의 보기값과
 * 같은 문자열이어야 prompt 모드와 같은 기준으로 걸러낼 수 있다.
 */
const REFERENCE_FACES: readonly ReferenceFace[] = [
  { id: "ref-01", label: "20대 초반 여성 A", gender: "여성", ethnicity: "한국인", age_group: "20대 초반" },
  { id: "ref-02", label: "20대 후반 여성 A", gender: "여성", ethnicity: "한국인", age_group: "20대 후반" },
  { id: "ref-03", label: "30대 초반 여성 A", gender: "여성", ethnicity: "한국인", age_group: "30대 초반" },
  { id: "ref-04", label: "40대 여성 A", gender: "여성", ethnicity: "한국인", age_group: "40대" },
  { id: "ref-05", label: "20대 후반 남성 A", gender: "남성", ethnicity: "한국인", age_group: "20대 후반" },
  { id: "ref-06", label: "30대 초반 남성 A", gender: "남성", ethnicity: "일본인", age_group: "30대 초반" },
].map((face) => ({ ...face, thumbnail_url: `/api/v1/reference-faces/${face.id}/thumbnail` }));

export function listMockReferenceFaces(): ReferenceFace[] {
  return REFERENCE_FACES.map((face) => ({ ...face }));
}

/** 접수 검증에서 쓴다. 목록에 없는 id 로는 job 을 만들 수 없어야 한다. */
export function hasMockReferenceFace(faceId: string): boolean {
  return REFERENCE_FACES.some((face) => face.id === faceId);
}

export function mockReferenceFaceThumbnail(faceId: string): { bytes: Uint8Array; filename: string } | null {
  const index = REFERENCE_FACES.findIndex((face) => face.id === faceId);
  if (index < 0) return null;
  const face = REFERENCE_FACES[index];
  // 얼굴마다 색을 달리해 목록에서 서로 구분되게 한다. 실제 사진은 백엔드가 내려준다.
  const hue = (index * 47) % 360;
  const size = 320;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="hsl(${hue} 45% 88%)"/><circle cx="${size / 2}" cy="${size * 0.42}" r="${size * 0.22}" fill="hsl(${hue} 40% 78%)"/><path d="M${size * 0.18} ${size} Q${size * 0.5} ${size * 0.6} ${size * 0.82} ${size}Z" fill="hsl(${hue} 40% 72%)"/><text x="50%" y="${size * 0.93}" text-anchor="middle" font-family="sans-serif" font-size="${size * 0.075}" fill="hsl(${hue} 30% 30%)">${face.label}</text></svg>`;
  return { bytes: new TextEncoder().encode(svg), filename: `reference-${faceId}-mock.svg` };
}

function blogScale(job: StoredBlogJob): number {
  return job.scenario === "slow" ? 5 : 1;
}

function blogElapsed(job: StoredBlogJob, nowMs: number): number {
  return nowMs - (job.retryAtMs ?? job.createdAtMs);
}

function blogStatus(job: StoredBlogJob, nowMs: number): JobStatus {
  const elapsedMs = blogElapsed(job, nowMs);
  if (job.retryAtMs === null && elapsedMs < QUEUED_MS * blogScale(job)) return "queued";
  if (elapsedMs < BLOG_DONE_MS * blogScale(job)) return "processing";
  if (!job.retried && job.scenario === "blog-fail") return "failed";
  return "completed";
}

function blogResult(job: StoredBlogJob): BlogWireResult {
  // 선택 필드는 빈 문자열로 올 수 있다. 비면 그 문장을 아예 빼서,
  // 값이 없을 때 결과가 어떻게 달라지는지 화면에서 바로 보이게 한다.
  const {
    main_treatment: treatment,
    base_cut: baseCut,
    design_point: designPoint,
    customer_pain_point: painPoint,
    designer_name: designer,
    region_keyword: region,
    hair_length: hairLength,
    hair_texture: hairTexture,
    hair_thickness: hairThickness,
    damage_level: damage,
    duration_minutes: duration,
    special_product: product,
  } = job.payload;

  const condition = [hairLength, hairTexture, hairThickness, damage].filter(Boolean).join(" · ");

  return {
    title: `${region ? `${region} ` : ""}${treatment} | ${baseCut}으로 바꾼 스타일`,
    intro: `${painPoint} 이런 고민으로 찾아주셨는데요. ${baseCut}에 ${treatment}을 더해 ${designPoint} 방향으로 정리해드렸습니다.`,
    sections: {
      before: {
        heading: "시술 전 고민과 모발 상태",
        body: `${painPoint}${condition ? ` 상담에서 확인한 모발 상태는 ${condition}이었습니다.` : ""}`,
      },
      process: {
        heading: `상담을 바탕으로 진행한 ${treatment}`,
        body: `${baseCut}으로 기본 형태를 잡고 ${treatment}을 진행했습니다.${product ? ` 시술 전후로 ${product}를 사용해 손상을 줄였습니다.` : ""}${duration ? ` 전체 소요 시간은 ${duration}분이었습니다.` : ""}`,
      },
      after: {
        heading: "시술 후 달라진 모습",
        body: `${designPoint} 부분이 살아나면서 아침 손질이 한결 수월해졌습니다.`,
      },
      home_care: {
        heading: "집에서 이어가는 홈케어",
        body: `${product ? `${product}를 타월 드라이 후 모발 중간부터 도포하고, ` : ""}드라이 바람은 위에서 아래로 향하게 해주세요. 작은 습관이 스타일 유지 기간을 늘려줍니다.`,
      },
    },
    // "김서연가"처럼 조사가 어긋나지 않도록 이름 뒤에 "디자이너"를 붙여 받침 문제를 피한다.
    closing: `${region ? `${region}에서 ` : ""}${designer ? `${designer} 디자이너` : "담당 디자이너"}가 상담해드립니다. 현재 모발 상태에 맞는 방법을 함께 찾아드릴게요.`,
    // 네이버 해시태그는 공백에서 끊긴다. 공백을 지우고, 태그로 쓰기엔 긴 문장(design_point)은 넣지 않는다.
    hashtags: [region, treatment, baseCut, "헤어관리", "미용실추천"]
      .filter(Boolean)
      .map((tag) => tag.replace(/\s+/g, ""))
      .slice(0, 5),
  };
}

export function createMockBlogJob(
  payload: CreateBlogJobPayload,
  scenario: BlogMockScenario,
): CreateBlogJobResponse {
  const nowMs = Date.now();
  const id = `blog-${crypto.randomUUID()}`;
  const job: StoredBlogJob = {
    id,
    testCode: `T-${Math.floor(1_000 + Math.random() * 9_000)}`,
    scenario,
    payload,
    createdAtMs: nowMs,
    attempt: 1,
    retryAtMs: null,
    retried: false,
  };
  blogJobs.set(id, job);
  return {
    job_id: id,
    test_code: job.testCode,
    status: "queued",
    created_at: iso(nowMs),
    request_id: requestId(),
  };
}

export function getMockBlogJob(jobId: string): BlogJobWireResponse | null {
  const job = blogJobs.get(jobId);
  if (!job) return null;
  const nowMs = Date.now();
  const status = blogStatus(job, nowMs);
  return {
    job_id: job.id,
    test_code: job.testCode,
    status,
    attempt: job.attempt,
    result: status === "completed" ? blogResult(job) : null,
    error: status === "failed"
      ? { code: "BLOG_GENERATION_FAILED", message: "블로그 글 생성에 실패했습니다. 다시 시도해주세요.", retryable: true }
      : null,
    created_at: iso(job.createdAtMs),
    updated_at: iso(nowMs),
    result_expires_at: iso(job.createdAtMs + TTL_MS),
    request_id: requestId(),
  };
}

export function retryMockBlogJob(
  jobId: string,
): { response: RetryBlogJobResponse | null; reason: "missing" | "not-retryable" | null } {
  const job = blogJobs.get(jobId);
  if (!job) return { response: null, reason: "missing" };
  const current = getMockBlogJob(jobId);
  if (current?.status !== "failed" || !current.error?.retryable) {
    return { response: null, reason: "not-retryable" };
  }
  job.attempt += 1;
  job.retryAtMs = Date.now();
  job.retried = true;
  return {
    response: { job_id: job.id, status: "processing", attempt: job.attempt, request_id: requestId() },
    reason: null,
  };
}

export function deleteMockBlogJob(jobId: string): boolean {
  return blogJobs.delete(jobId);
}

export function parseBlogMockScenario(value: string | null): BlogMockScenario {
  if (value === "blog-fail" || value === "slow") return value;
  return "normal";
}
