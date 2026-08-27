import "server-only";

import type {
  ApiError,
  BlogMockScenario,
  BlogWireResult,
  CreateBlogJobPayload,
  CreateFaceSwapJobResponse,
  FaceSwapJobResponse,
  JobStatus,
  MockScenario,
  Ratio,
  ReferenceFace,
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
const jobs =
  store.__salonFaceSwapMockJobs ?? new Map<string, StoredFaceSwapJob>();
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
  if (job.retryAtMs === null && elapsedMs < QUEUED_MS * scale(job))
    return "queued";
  if (elapsedMs < IMAGE_DONE_MS * scale(job)) return "processing";
  if (
    !job.retried &&
    (job.scenario === "image-fail" || job.scenario === "face-not-detected")
  )
    return "failed";
  return "completed";
}

function jobError(job: StoredFaceSwapJob, status: JobStatus): ApiError | null {
  if (status !== "failed") return null;
  if (job.scenario === "face-not-detected") {
    return {
      code: "FACE_NOT_DETECTED",
      message:
        "얼굴을 찾지 못했습니다. 정면에 가까운 사진으로 다시 시도해주세요.",
      retryable: false,
    };
  }
  return {
    code: "IMAGE_GENERATION_FAILED",
    message: "얼굴 교체 이미지 생성에 실패했습니다. 다시 시도해주세요.",
    retryable: true,
  };
}

function imageResults(
  jobId: string,
): Record<Ratio, { url: string; format_mode: "crop" | "fit_pad" }> {
  return {
    "1:1": {
      url: `/api/v1/face-swap-jobs/${jobId}/images/1x1`,
      format_mode: "crop",
    },
    "4:5": {
      url: `/api/v1/face-swap-jobs/${jobId}/images/4x5`,
      format_mode: "crop",
    },
    "9:16": {
      url: `/api/v1/face-swap-jobs/${jobId}/images/9x16`,
      format_mode: "fit_pad",
    },
  };
}

export function createMockFaceSwapJob(
  scenario: MockScenario,
): CreateFaceSwapJobResponse {
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

export function retryMockFaceSwapJob(jobId: string): {
  response: RetryFaceSwapJobResponse | null;
  reason: "missing" | "not-retryable" | null;
} {
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
  if (
    value === "image-fail" ||
    value === "face-not-detected" ||
    value === "slow"
  )
    return value;
  return "normal";
}

export function mockFaceSwapImage(
  jobId: string,
  ratio: string,
): { bytes: Uint8Array; filename: string } | null {
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
  return {
    bytes: new TextEncoder().encode(svg),
    filename: `salon-${ratio}-mock.svg`,
  };
}

/**
 * 참조 얼굴 풀(조합 3) — 실제 백엔드와 같은 53장 구성이다(#201 로 21장 추가).
 *
 * 출처는 backend/src/api/reference_faces.py 의 REFERENCE_FACES 상수. id·label·성별·
 * 국적·연령대를 그대로 옮겼다. mock 이 실서버와 다르면 로컬에서 만든 화면이
 * 실서버에서 다르게 보인다 — 6장짜리 옛 mock 으로 그리다 32장 실물에서 목록이
 * 폰 화면을 덮은 것이 그 예다. 백엔드 목록이 바뀌면 여기도 같이 맞춘다.
 * 8/27 기준 53장이다(#201 로 21장 추가).
 *
 * label 에 국적이 이미 들어 있다("한국인 20대 여성 A"). 화면은 label 만 보여주고
 * ethnicity 는 필터용 데이터로만 쓴다.
 */
const REFERENCE_FACES: readonly ReferenceFace[] = (
  [
    // 8/27 추가분(ref-33~53). 백엔드가 목록 앞에 두었으므로(#201) 여기서도 앞에 둔다 —
    // 순서까지 같아야 로컬에서 본 화면이 실서버와 같다.
    ["ref-33", "한국인 20대 여성 E", "여성", "한국인", "20대"],
    ["ref-34", "한국인 20대 여성 F", "여성", "한국인", "20대"],
    ["ref-35", "한국인 20대 여성 G", "여성", "한국인", "20대"],
    ["ref-36", "한국인 20대 여성 H", "여성", "한국인", "20대"],
    ["ref-37", "한국인 20대 여성 I", "여성", "한국인", "20대"],
    ["ref-38", "한국인 20대 여성 J", "여성", "한국인", "20대"],
    ["ref-39", "한국인 20대 여성 K", "여성", "한국인", "20대"],
    ["ref-40", "한국인 20대 여성 L", "여성", "한국인", "20대"],
    ["ref-41", "한국인 20대 여성 M", "여성", "한국인", "20대"],
    ["ref-42", "한국인 20대 여성 N", "여성", "한국인", "20대"],
    ["ref-43", "한국인 20대 여성 O", "여성", "한국인", "20대"],
    ["ref-44", "한국인 20대 여성 P", "여성", "한국인", "20대"],
    ["ref-45", "한국인 20대 여성 Q", "여성", "한국인", "20대"],
    ["ref-46", "한국인 20대 여성 R", "여성", "한국인", "20대"],
    ["ref-47", "한국인 20대 여성 S", "여성", "한국인", "20대"],
    ["ref-48", "한국인 20대 여성 T", "여성", "한국인", "20대"],
    ["ref-49", "한국인 20대 여성 U", "여성", "한국인", "20대"],
    ["ref-50", "한국인 20대 여성 V", "여성", "한국인", "20대"],
    ["ref-51", "한국인 20대 여성 W", "여성", "한국인", "20대"],
    ["ref-52", "한국인 20대 여성 X", "여성", "한국인", "20대"],
    ["ref-53", "한국인 20대 여성 Y", "여성", "한국인", "20대"],
    ["ref-01", "한국인 20대 여성 A", "여성", "한국인", "20대"],
    ["ref-02", "한국인 20대 여성 B", "여성", "한국인", "20대"],
    ["ref-03", "한국인 20대 여성 C", "여성", "한국인", "20대"],
    ["ref-04", "한국인 20대 여성 D", "여성", "한국인", "20대"],
    ["ref-05", "한국인 20대 남성 A", "남성", "한국인", "20대"],
    ["ref-06", "한국인 20대 남성 B", "남성", "한국인", "20대"],
    ["ref-07", "한국인 20대 남성 C", "남성", "한국인", "20대"],
    ["ref-08", "한국인 30대 여성 A", "여성", "한국인", "30대"],
    ["ref-09", "한국인 30대 여성 B", "여성", "한국인", "30대"],
    ["ref-10", "한국인 30대 여성 C", "여성", "한국인", "30대"],
    ["ref-11", "한국인 30대 남성 A", "남성", "한국인", "30대"],
    ["ref-12", "한국인 30대 남성 B", "남성", "한국인", "30대"],
    ["ref-13", "한국인 40대 여성 A", "여성", "한국인", "40대"],
    ["ref-14", "한국인 40대 여성 B", "여성", "한국인", "40대"],
    ["ref-15", "한국인 40대 남성 A", "남성", "한국인", "40대"],
    ["ref-16", "한국인 40대 남성 B", "남성", "한국인", "40대"],
    ["ref-17", "한국인 50대 여성 A", "여성", "한국인", "50대"],
    ["ref-18", "한국인 50대 여성 B", "여성", "한국인", "50대"],
    ["ref-19", "한국인 50대 남성 A", "남성", "한국인", "50대"],
    ["ref-20", "한국인 50대 남성 B", "남성", "한국인", "50대"],
    ["ref-21", "일본인 20대 여성", "여성", "일본인", "20대"],
    ["ref-22", "중국인 20대 여성", "여성", "중국인", "20대"],
    ["ref-23", "서양인 20대 여성", "여성", "서양인", "20대"],
    ["ref-24", "동남아시아인 20대 여성", "여성", "동남아시아인", "20대"],
    ["ref-25", "흑인 20대 여성", "여성", "흑인", "20대"],
    ["ref-26", "중동인 20대 여성", "여성", "중동인", "20대"],
    ["ref-27", "일본인 20대 남성", "남성", "일본인", "20대"],
    ["ref-28", "중국인 20대 남성", "남성", "중국인", "20대"],
    ["ref-29", "서양인 20대 남성", "남성", "서양인", "20대"],
    ["ref-30", "동남아시아인 20대 남성", "남성", "동남아시아인", "20대"],
    ["ref-31", "흑인 20대 남성", "남성", "흑인", "20대"],
    ["ref-32", "중동인 20대 남성", "남성", "중동인", "20대"],
  ] as const
).map(([id, label, gender, ethnicity, age_group]) => ({
  id,
  label,
  gender,
  ethnicity,
  age_group,
  thumbnail_url: `/api/v1/reference-faces/${id}/thumbnail`,
}));

export function listMockReferenceFaces(): ReferenceFace[] {
  return REFERENCE_FACES.map((face) => ({ ...face }));
}

/** 접수 검증에서 쓴다. 목록에 없는 id 로는 job 을 만들 수 없어야 한다. */
export function hasMockReferenceFace(faceId: string): boolean {
  return REFERENCE_FACES.some((face) => face.id === faceId);
}

export function mockReferenceFaceThumbnail(
  faceId: string,
): { bytes: Uint8Array; filename: string } | null {
  const index = REFERENCE_FACES.findIndex((face) => face.id === faceId);
  if (index < 0) return null;
  // 얼굴마다 색을 달리해 목록에서 서로 구분되게 한다. 실제 사진은 백엔드가 내려준다.
  //
  // 그림 안에 label 을 글자로 넣지 않는다 — 화면은 닉네임으로 부르는데(#204) 카드 그림에
  // 옛 라벨이 함께 찍혀 한 칸에 이름이 둘로 보였다. 실서버 사진에는 없는 글자라 mock 에서만
  // 나던 차이다. 이름은 카드 캡션이, 낭독용 정보는 alt 가 맡는다.
  const hue = (index * 47) % 360;
  const size = 320;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="hsl(${hue} 45% 88%)"/><circle cx="${size / 2}" cy="${size * 0.42}" r="${size * 0.22}" fill="hsl(${hue} 40% 78%)"/><path d="M${size * 0.18} ${size} Q${size * 0.5} ${size * 0.6} ${size * 0.82} ${size}Z" fill="hsl(${hue} 40% 72%)"/></svg>`;
  return {
    bytes: new TextEncoder().encode(svg),
    filename: `reference-${faceId}-mock.svg`,
  };
}

function blogScale(job: StoredBlogJob): number {
  return job.scenario === "slow" ? 5 : 1;
}

function blogElapsed(job: StoredBlogJob, nowMs: number): number {
  return nowMs - (job.retryAtMs ?? job.createdAtMs);
}

function blogStatus(job: StoredBlogJob, nowMs: number): JobStatus {
  const elapsedMs = blogElapsed(job, nowMs);
  if (job.retryAtMs === null && elapsedMs < QUEUED_MS * blogScale(job))
    return "queued";
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

  const condition = [hairLength, hairTexture, hairThickness, damage]
    .filter(Boolean)
    .join(" · ");

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

export function createMockBlogJob(): BlogWireResult {
  return {
    title: "학동역 레이어드 컷과 C컬 펌으로 완성한 자연스러운 볼륨",
    intro:
      "긴 직모를 가진 고객님이 축 처지는 모발로 인한 스타일링의 어려움과 자고 일어난 후 부스스해지는 문제로 고민하고 계셨습니다. 고객님의 얼굴형을 보완하고 자연스러운 볼륨을 더하기 위해 레이어드 컷과 C컬 펌을 제안드렸습니다. 시술 후 고객님은 건강하고 아름다운 스타일을 찾으셨습니다.\n\n",
    sections: {
      before: {
        heading: "고객님의 고민과 상황",
        body: "고객님은 긴 머리의 직모를 가진 분으로, 모발이 두꺼워 자주 축 처지곤 하셨습니다. 이러한 머리카락은 자고 일어난 후 부스스해져 스타일링이 어려워 불편함을 느끼셨습니다. 특히, 스타일링을 해도 쉽게 풀려버려 매일 같은 스타일을 유지하기 힘든 상황이었습니다. 고객님은 이러한 문제를 해결하기 위해 자연스러운 볼륨과 함께 얼굴형을 보완할 수 있는 시술을 원하셨습니다. 이러한 고민을 해결하기 위해, 고객님과의 상담을 통해 적합한 시술을 계획하게 되었습니다.\n\n",
      },
      process: {
        heading: "디자이너의 기술적 접근",
        body: "고객님의 모발 상태와 원하는 스타일을 고려하여, 레이어드 컷과 C컬 펌을 조합한 시술을 진행했습니다. 먼저, 레이어드 컷을 통해 모발에 자연스러운 층을 주어 가벼운 느낌을 더했습니다. 이는 모발의 무게감을 줄이고, 전체적인 볼륨을 향상시키는 데 큰 도움이 되었습니다. 레이어드 컷은 고객님의 얼굴형을 더욱 돋보이게 하여 전체적인 조화를 이루도록 했습니다.\n\n이후, C컬 펌을 통해 고객님의 모발에 더욱 생동감 있는 컬을 추가했습니다. C컬 펌은 자연스러운 곡선을 만들어 주어, 무거운 머리카락이 아닌 가벼운 느낌으로 스타일을 완성할 수 있었습니다. 고객님의 모발이 두꺼운 편이라, 펌의 지속성을 고려하여 적절한 열과 시간을 조절하며 시술하였습니다. 또한, 모로칸 오일을 사용하여 모발에 영양을 주고, 손상을 최소화하는 데 중점을 두었습니다. 이 모든 과정은 고객님과의 충분한 상담을 바탕으로 진행되었으며, 고객님이 원하는 스타일을 최우선으로 두었습니다.\n\n",
      },
      after: {
        heading: "시술 후 변화와 만족감",
        body: "시술이 완료된 후 고객님은 거울을 보며 만족스러운 미소를 지으셨습니다. 레이어드 컷과 C컬 펌의 조합으로 모발에 자연스러운 볼륨이 더해져, 축 처지던 머리카락이 생동감 있게 변모했습니다. 고객님은 자고 일어난 후에도 부스스한 느낌이 줄어들어, 스타일링이 훨씬 수월해졌다고 말씀하셨습니다. 또한, 얼굴형을 보완하는 효과로 인해 더욱 젊고 건강한 인상을 주게 되었습니다. 이러한 변화는 고객님에게 큰 자신감을 주었으며, 일상생활에서도 새로운 스타일을 즐길 수 있는 계기가 되었습니다.\n\n",
      },
      home_care: {
        heading: "홈케어 꿀팁",
        body: "시술 후에도 모발을 건강하게 유지하기 위해 몇 가지 홈케어 팁을 안내해 드립니다. 첫째, 시술 후 적어도 일주일간은 열기구 사용을 자제하는 것이 좋습니다. 둘째, 샴푸 후에는 반드시 모로칸 오일과 같은 영양이 풍부한 오일을 사용하여 모발에 수분을 공급해 주세요. 이는 컬의 유지와 함께 모발의 건강을 지키는 데 큰 도움이 됩니다. 셋째, 자주 트리트먼트를 통해 손상을 예방하고 건강한 모발을 유지하는 것이 중요합니다. 마지막으로, 스타일링 시에는 열을 최소화하고, 저온에서 천천히 컬을 만드는 것을 추천드립니다. 이러한 홈케어 방법을 통해 시술의 효과를 더욱 오래 지속할 수 있습니다.\n\n",
      },
    },
    closing:
      "학동역 1번 출구 근처에 위치한 저희 미용실에서는 고객님을 위한 맞춤형 상담과 시술을 제공하고 있습니다. 1:1 상담 및 예약은 전화 또는 온라인으로 가능합니다. 언제든지 편하게 방문해 주세요.\n\n",
    hashtags: ["학동역미용실", "C컬펌", "레이어드컷", "볼륨펌", "홈케어팁"],
  };
}

export function parseBlogMockScenario(value: string | null): BlogMockScenario {
  if (value === "blog-fail" || value === "slow") return value;
  return "normal";
}
