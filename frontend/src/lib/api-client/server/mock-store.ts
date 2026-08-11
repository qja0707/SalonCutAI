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
  const theme = job.payload.theme?.trim();
  const context = job.payload.domainContext?.trim();
  return {
    title: `${job.payload.topic.trim()} | 헤어 전문가가 알려드려요`,
    intro: `${theme ? `${theme}에 관심이 있으시다면 ` : ""}${job.payload.topic.trim()}에 대해 궁금하셨을 텐데요. 오늘은 살롱에서 꼭 알아두면 좋은 내용을 ${job.payload.tone} 설명해드릴게요.`,
    sections: {
      before: {
        heading: "시술 전 고민과 모발 상태",
        body: `고객님은 ${job.payload.topic.trim()}에 대한 고민으로 방문하셨어요. 원하는 분위기와 평소 손질 습관을 함께 확인해 현재 상태에 맞는 방향을 정했습니다.`,
      },
      process: {
        heading: "상담을 바탕으로 진행한 시술",
        body: `${theme ? `${theme} 분위기를 살리면서 ` : ""}모발에 부담을 줄이도록 단계별로 상태를 확인하며 시술을 진행했습니다.`,
      },
      after: {
        heading: "시술 후 달라진 모습",
        body: `${context ? `${context}의 상담 경험을 바탕으로 ` : ""}고객님이 원하신 방향과 손질 편의성을 함께 확인해 마무리했습니다.`,
      },
      home_care: {
        heading: "집에서 이어가는 홈케어",
        body: "예쁜 스타일을 오래 유지할 수 있도록 세정과 건조 순서, 손질할 때 주의할 점을 안내해드렸어요. 작은 관리 습관을 꾸준히 지켜주세요.",
      },
    },
    closing: "궁금한 점은 편하게 상담해보세요. 현재 모발 상태에 맞는 방법을 함께 찾아드릴게요.",
    hashtags: ["헤어스타일", "미용실추천", "헤어관리", "살롱상담", theme || "뷰티정보"],
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
