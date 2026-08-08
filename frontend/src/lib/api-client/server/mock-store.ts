import "server-only";

import type {
  ApiError,
  CreateFaceSwapJobResponse,
  FaceSwapJobResponse,
  JobStatus,
  MockScenario,
  Ratio,
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

type GlobalMockStore = typeof globalThis & {
  __salonFaceSwapMockJobs?: Map<string, StoredFaceSwapJob>;
};

const store = globalThis as GlobalMockStore;
const jobs = store.__salonFaceSwapMockJobs ?? new Map<string, StoredFaceSwapJob>();
store.__salonFaceSwapMockJobs = jobs;

const IMAGE_DONE_MS = 14_000;
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
