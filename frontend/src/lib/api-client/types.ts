export const RATIOS = ["1:1", "4:5", "9:16"] as const;
export const BLOG_SECTION_ORDER = ["before", "process", "after", "home_care"] as const;

export type Ratio = (typeof RATIOS)[number];
export type BlogSectionKey = (typeof BLOG_SECTION_ORDER)[number];
export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type MockScenario = "normal" | "image-fail" | "face-not-detected" | "slow";
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
  };
};
