export const RATIOS = ["1:1", "4:5", "9:16"] as const;
export const BLOG_TONES = ["친근하게", "차분하게", "발랄하게", "전문적으로"] as const;
export const BLOG_SECTION_ORDER = ["before", "process", "after", "home_care"] as const;

export type Ratio = (typeof RATIOS)[number];
export type BlogTone = (typeof BLOG_TONES)[number];
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

export type CreateBlogJobPayload = {
  topic: string;
  theme?: string;
  tone: BlogTone;
  domainContext?: string;
};

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
