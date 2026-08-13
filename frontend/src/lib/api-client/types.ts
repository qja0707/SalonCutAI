export const RATIOS = ["1:1", "4:5", "9:16"] as const;
export const BLOG_SECTION_ORDER = [
  "before",
  "process",
  "after",
  "home_care",
] as const;

export type Ratio = (typeof RATIOS)[number];
export type BlogSectionKey = (typeof BLOG_SECTION_ORDER)[number];
export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type MockScenario =
  | "normal"
  | "image-fail"
  | "face-not-detected"
  | "slow";
export type BlogMockScenario = "normal" | "blog-fail" | "slow";

export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ErrorEnvelope = {
  error: ApiError;
  request_id: string;
};

export type BlogSection = { heading: string; body: string };

export type BlogResult = {
  title: string;
  intro: string;
  sections: BlogSection[];
  closing: string;
  hashtags: string[];
};

export type BlogWireResult = {
  title: string;
  intro: string;
  sections: Record<BlogSectionKey, BlogSection>;
  closing: string;
  hashtags: string[];
};

/**
 * 백엔드 BlogGenerationRequest 와 같은 12필드 (Discussion #53).
 * 선택 필드를 고르지 않으면 빈 문자열을 보낸다 — null 이나 키 생략이 아니다(규범님 8/11).
 * 톤 앤 매너는 12필드에 없고 프롬프트가 문체를 고정하므로 전송하지 않는다(8/11 회의).
 */
export type CreateBlogJobPayload = {
  hair_length: string;
  hair_texture: string;
  hair_thickness: string;
  damage_level: string;
  customer_pain_point: string;
  base_cut: string;
  main_treatment: string;
  design_point: string;
  designer_name: string;
  duration_minutes: string;
  special_product: string;
  region_keyword: string;
};

export const BLOG_FIELD_KEYS = [
  "hair_length",
  "hair_texture",
  "hair_thickness",
  "damage_level",
  "customer_pain_point",
  "base_cut",
  "main_treatment",
  "design_point",
  "designer_name",
  "duration_minutes",
  "special_product",
  "region_keyword",
] as const satisfies readonly (keyof CreateBlogJobPayload)[];

/** 값이 없으면 글이 성립하지 않는 4개. 나머지는 비어도 접수한다. */
export const BLOG_REQUIRED_FIELDS = [
  "main_treatment",
  "base_cut",
  "design_point",
  "customer_pain_point",
] as const satisfies readonly (keyof CreateBlogJobPayload)[];

type BlogJobEnvelope<TResult> = {
  job_id: string;
  test_code: string;
  status: JobStatus;
  attempt: number;
  result: TResult | null;
  error: ApiError | null;
  created_at: string;
  updated_at: string;
  result_expires_at: string;
  request_id: string;
};

export type BlogJobResponse = BlogJobEnvelope<BlogResult>;
export type BlogJobWireResponse = BlogJobEnvelope<BlogWireResult>;

export type CreateBlogJobResponse = Pick<
  BlogJobResponse,
  "job_id" | "test_code" | "status" | "created_at" | "request_id"
>;

export type RetryBlogJobResponse = {
  job_id: string;
  status: "processing";
  attempt: number;
  request_id: string;
};

export type ImageResult = {
  url: string;
  format_mode: "crop" | "fit_pad";
};

export type FaceSwapJobResponse = {
  job_id: string;
  test_code: string;
  status: JobStatus;
  attempt: number;
  queue_position: number | null;
  results: Record<Ratio, ImageResult> | null;
  meta: { seed: number; gen_sec: number } | null;
  error: ApiError | null;
  consent_recorded_at: string;
  created_at: string;
  updated_at: string;
  source_expires_at: string;
  result_expires_at: string;
  request_id: string;
};

export type CreateFaceSwapJobResponse = Pick<
  FaceSwapJobResponse,
  "job_id" | "test_code" | "status" | "created_at" | "request_id"
>;

export type RetryFaceSwapJobResponse = {
  job_id: string;
  status: "processing";
  attempt: number;
  request_id: string;
};

/**
 * 어떤 얼굴로 바꿀지 지정하는 값 (수민님 8/11 제안, 조합 3·5 하이브리드).
 *
 * - reference — 조합 3(InstantID). 미리 만들어둔 가상 얼굴 중에서 고른다
 * - prompt    — 조합 5(인페인팅). 국적·성별·연령대로 얼굴을 묘사한다
 *
 * 두 방식을 한 객체에 평평하게 펼치지 않고 감싼 이유는, 쓰지 않는 쪽을 지울지
 * 남길지 매번 판단하지 않기 위해서다. `background_mode`/`background_style` 처럼
 * 짝을 맞춰야 하는 필드가 늘면 검증 조건이 곱으로 늘어난다.
 */
export const FACE_MODES = ["reference", "prompt"] as const;
export type FaceMode = (typeof FACE_MODES)[number];

/**
 * 값은 한글 그대로 보낸다. 영문 프롬프트 변환은 백엔드 몫이다(8/11 수민님께 전달).
 * 프론트가 영문 어휘까지 정하면 모델 프롬프트를 손볼 때마다 화면을 같이 고쳐야 한다.
 *
 * 세부는 4개다 — 표정을 얼굴 스타일에서 떼어냈고, 피부 타입을 스킨 톤으로 바꿨다(#69).
 * 이유는 face-taxonomy.ts 의 각 목록 주석 참고.
 */
export type FacePromptOptions = {
  ethnicity: string; // 필수
  gender: string; // 필수
  age: string; // 필수
  face_style: string; // 선택 — 미선택 시 빈 문자열
  expression: string; // 선택
  skin_tone: string; // 선택
  makeup: string; // 선택
};

export type FaceReferenceOptions = {
  reference_face_id: string;
};

/** 쓰는 쪽만 채우고 반대쪽은 null. 서버 검증도 이 규칙 하나만 본다. */
export type FaceOption =
  | { mode: "reference"; reference: FaceReferenceOptions; prompt: null }
  | { mode: "prompt"; reference: null; prompt: FacePromptOptions };

export const FACE_PROMPT_REQUIRED_KEYS = [
  "ethnicity",
  "gender",
  "age",
] as const satisfies readonly (keyof FacePromptOptions)[];

export const FACE_PROMPT_OPTIONAL_KEYS = [
  "face_style",
  "expression",
  "skin_tone",
  "makeup",
] as const satisfies readonly (keyof FacePromptOptions)[];

/** 참조 얼굴 목록 항목. `age_group`·`ethnicity` 는 prompt 모드와 같은 보기값을 쓴다. */
export type ReferenceFace = {
  id: string;
  label: string;
  gender: string;
  ethnicity: string;
  age_group: string;
  thumbnail_url: string;
};

/** 배열을 그대로 두지 않고 감싼다. 나중에 총 개수나 페이지 정보를 붙일 자리가 생긴다. */
export type ReferenceFacesResponse = {
  items: ReferenceFace[];
  request_id: string;
};

export type CreateFaceSwapJobPayload = {
  consent: {
    agreed: boolean;
    consent_version: string;
  };
  options: {
    ratios: Ratio[];
    seed: number | null;
    background_mode: "preserve" | "replace";
    background_style: string | null;
    face: FaceOption;
  };
};

// 로그인 관련 타입
export type SigninPayload = {
  id: string;
  pw: string;
};

export type SigninResponse = {
  access_token: string;
  refresh_token: string;
};
