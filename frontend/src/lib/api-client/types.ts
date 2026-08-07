export const RATIOS = ["1:1", "4:5", "9:16"] as const;

export type Ratio = (typeof RATIOS)[number];
export type JobStatus = "queued" | "processing" | "completed" | "partial" | "failed";
export type ComponentStatus = Exclude<JobStatus, "partial">;
export type MockScenario = "normal" | "blog-fail" | "image-fail" | "both-fail" | "slow";

export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ErrorEnvelope = {
  error: ApiError;
  request_id: string;
};

export type BlogResult = {
  title: string;
  body: string;
  hashtags: string[];
};

export type ImageResult = {
  url: string;
  format_mode: "crop" | "fit_pad";
};

export type JobResponse = {
  job_id: string;
  test_code: string;
  status: JobStatus;
  image: {
    status: ComponentStatus;
    attempt: number;
    queue_position: number | null;
    results: Record<Ratio, ImageResult> | null;
    meta: { seed: number; gen_sec: number } | null;
    error: ApiError | null;
  };
  blog: {
    status: ComponentStatus;
    attempt: number;
    result: BlogResult | null;
    error: ApiError | null;
  };
  consent_recorded_at: string;
  created_at: string;
  updated_at: string;
  source_expires_at: string;
  result_expires_at: string;
  request_id: string;
};

export type CreateJobResponse = Pick<
  JobResponse,
  "job_id" | "test_code" | "status" | "created_at" | "request_id"
>;

export type RetryJobResponse = {
  job_id: string;
  status: "processing";
  retried: { component: "image" | "blog"; attempt: number }[];
  request_id: string;
};

export type CreateJobPayload = {
  consent: {
    agreed: true;
    consent_version: string;
  };
  blog_input: {
    hair_length: string;
    hair_texture: string;
    hair_thickness: string;
    damage_level: string;
    customer_pain_point: string;
    base_cut: string;
    main_treatment: string;
    design_point: string;
    region_keyword: string;
    designer_name?: string;
    duration_minutes?: number;
    special_product?: string;
  };
  options: {
    ratios: Ratio[];
    seed: number | null;
  };
};
