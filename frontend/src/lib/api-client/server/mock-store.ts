import "server-only";

import type {
  ApiError,
  BlogResult,
  ComponentStatus,
  CreateJobResponse,
  JobResponse,
  JobStatus,
  MockScenario,
  Ratio,
  RetryJobResponse,
} from "@/lib/api-client/types";
import { requestId } from "@/lib/api-client/server/response";

type ComponentName = "image" | "blog";

type StoredJob = {
  id: string;
  testCode: string;
  scenario: MockScenario;
  createdAtMs: number;
  consentRecordedAt: string;
  imageAttempt: number;
  blogAttempt: number;
  imageRetryAtMs: number | null;
  blogRetryAtMs: number | null;
  imageRetried: boolean;
  blogRetried: boolean;
};

type GlobalMockStore = typeof globalThis & {
  __salonMockJobs?: Map<string, StoredJob>;
};

const store = globalThis as GlobalMockStore;
const jobs = store.__salonMockJobs ?? new Map<string, StoredJob>();
store.__salonMockJobs = jobs;

const BLOG_DONE_MS = 6_000;
const IMAGE_DONE_MS = 14_000;
const QUEUED_MS = 2_000;
const TTL_MS = 24 * 60 * 60 * 1_000;

const BLOG_RESULT: BlogResult = {
  title: "손질이 편한 중단발 레이어드컷, 성수동 미용실 시술 기록",
  body:
    "[고객 고민]\n잦은 시술로 모발 끝이 갈라지고 아침마다 정돈이 어려웠어요.\n\n[디자인 제안]\n중단발 길이를 살리면서 얼굴선을 자연스럽게 감싸는 레이어드컷을 제안했습니다.\n\n[시술 포인트]\n손상 구간을 세심하게 정리하고 사이드뱅으로 가벼운 움직임을 더했습니다.\n\n[홈케어 안내]\n열기구 온도를 낮추고 모발 끝을 중심으로 에센스를 발라주세요.\n\n고객님의 생활 습관과 모발 상태에 맞춘 상담으로 오래 유지되는 스타일을 함께 찾아드리겠습니다.",
  hashtags: ["성수동미용실", "중단발레이어드컷", "사이드뱅", "손상모케어", "헤어스타일추천"],
};

function iso(timeMs: number): string {
  return new Date(timeMs).toISOString();
}

function scale(job: StoredJob): number {
  return job.scenario === "slow" ? 5 : 1;
}

function componentElapsed(job: StoredJob, component: ComponentName, nowMs: number): number {
  const retryAt = component === "image" ? job.imageRetryAtMs : job.blogRetryAtMs;
  return nowMs - (retryAt ?? job.createdAtMs);
}

function componentStatus(job: StoredJob, component: ComponentName, nowMs: number): ComponentStatus {
  const elapsed = componentElapsed(job, component, nowMs);
  const doneAt = (component === "image" ? IMAGE_DONE_MS : BLOG_DONE_MS) * scale(job);
  const retryAt = component === "image" ? job.imageRetryAtMs : job.blogRetryAtMs;

  if (retryAt === null && elapsed < QUEUED_MS * scale(job)) return "queued";
  if (elapsed < doneAt) return "processing";

  const shouldFail =
    component === "image"
      ? !job.imageRetried && (job.scenario === "image-fail" || job.scenario === "both-fail")
      : !job.blogRetried && (job.scenario === "blog-fail" || job.scenario === "both-fail");
  return shouldFail ? "failed" : "completed";
}

function topStatus(image: ComponentStatus, blog: ComponentStatus): JobStatus {
  if (image === "queued" && blog === "queued") return "queued";
  if (image === "queued" || image === "processing" || blog === "queued" || blog === "processing") return "processing";
  if (image === "completed" && blog === "completed") return "completed";
  if (image === "failed" && blog === "failed") return "failed";
  return "partial";
}

function imageError(status: ComponentStatus): ApiError | null {
  if (status !== "failed") return null;
  return {
    code: "FACE_NOT_DETECTED",
    message: "얼굴을 찾지 못했습니다. 정면에 가까운 사진으로 다시 시도해주세요.",
    retryable: false,
  };
}

function blogError(status: ComponentStatus): ApiError | null {
  if (status !== "failed") return null;
  return {
    code: "BLOG_GENERATION_FAILED",
    message: "블로그 글 생성에 실패했습니다. 다시 시도해주세요.",
    retryable: true,
  };
}

function imageResults(jobId: string): Record<Ratio, { url: string; format_mode: "crop" | "fit_pad" }> {
  return {
    "1:1": { url: `/api/v1/jobs/${jobId}/image/1x1`, format_mode: "crop" },
    "4:5": { url: `/api/v1/jobs/${jobId}/image/4x5`, format_mode: "crop" },
    "9:16": { url: `/api/v1/jobs/${jobId}/image/9x16`, format_mode: "fit_pad" },
  };
}

export function createMockJob(scenario: MockScenario): CreateJobResponse {
  const nowMs = Date.now();
  const id = `mock-job-${crypto.randomUUID()}`;
  const job: StoredJob = {
    id,
    testCode: `T-${Math.floor(1_000 + Math.random() * 9_000)}`,
    scenario,
    createdAtMs: nowMs,
    consentRecordedAt: iso(nowMs),
    imageAttempt: 1,
    blogAttempt: 1,
    imageRetryAtMs: null,
    blogRetryAtMs: null,
    imageRetried: false,
    blogRetried: false,
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

export function getStoredJob(jobId: string): StoredJob | null {
  return jobs.get(jobId) ?? null;
}

export function getMockJob(jobId: string): JobResponse | null {
  const job = jobs.get(jobId);
  if (!job) return null;

  const nowMs = Date.now();
  const imageStatus = componentStatus(job, "image", nowMs);
  const blogStatus = componentStatus(job, "blog", nowMs);
  const imageDone = imageStatus === "completed";
  const blogDone = blogStatus === "completed";

  return {
    job_id: job.id,
    test_code: job.testCode,
    status: topStatus(imageStatus, blogStatus),
    image: {
      status: imageStatus,
      attempt: job.imageAttempt,
      queue_position: imageStatus === "queued" ? 1 : null,
      results: imageDone ? imageResults(job.id) : null,
      meta: imageDone ? { seed: 42, gen_sec: IMAGE_DONE_MS / 1_000 } : null,
      error: imageError(imageStatus),
    },
    blog: {
      status: blogStatus,
      attempt: job.blogAttempt,
      result: blogDone ? BLOG_RESULT : null,
      error: blogError(blogStatus),
    },
    consent_recorded_at: job.consentRecordedAt,
    created_at: iso(job.createdAtMs),
    updated_at: iso(nowMs),
    source_expires_at: iso(job.createdAtMs + TTL_MS),
    result_expires_at: iso(job.createdAtMs + TTL_MS),
    request_id: requestId(),
  };
}

export function retryMockJob(
  jobId: string,
  components: ComponentName[],
): { response: RetryJobResponse | null; reason: "missing" | "not-retryable" | null } {
  const job = jobs.get(jobId);
  if (!job) return { response: null, reason: "missing" };
  if (components.length === 0 || new Set(components).size !== components.length) {
    return { response: null, reason: "not-retryable" };
  }

  const nowMs = Date.now();
  const current = getMockJob(jobId);
  if (!current) return { response: null, reason: "missing" };

  for (const component of components) {
    const value = current[component];
    if (value.status !== "failed" || !value.error?.retryable) {
      return { response: null, reason: "not-retryable" };
    }
  }

  const retried = components.map((component) => {
    if (component === "image") {
      job.imageAttempt += 1;
      job.imageRetryAtMs = nowMs;
      job.imageRetried = true;
      return { component, attempt: job.imageAttempt };
    }
    job.blogAttempt += 1;
    job.blogRetryAtMs = nowMs;
    job.blogRetried = true;
    return { component, attempt: job.blogAttempt };
  });

  return {
    response: {
      job_id: job.id,
      status: "processing",
      retried,
      request_id: requestId(),
    },
    reason: null,
  };
}

export function deleteMockJob(jobId: string): boolean {
  return jobs.delete(jobId);
}

export function parseMockScenario(value: string | null): MockScenario {
  if (value === "blog-fail" || value === "image-fail" || value === "both-fail" || value === "slow") return value;
  return "normal";
}

export function mockImage(jobId: string, ratio: string): { bytes: Uint8Array; filename: string } | null {
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
