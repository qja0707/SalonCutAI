export const RATIOS = ["1:1", "4:5", "9:16"] as const;

export type Ratio = (typeof RATIOS)[number];
export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type MockScenario = "normal" | "image-fail" | "face-not-detected" | "slow";

export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ErrorEnvelope = {
  error: ApiError;
  request_id: string;
};

// 블로그 전용 화면의 복사 유틸이 사용한다. 비동기 blog job 계약은 별도 PR에서 연결한다.
export type BlogResult = {
  title: string;
  body: string;
  hashtags: string[];
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
    agreed: true;
    consent_version: string;
  };
  options: {
    ratios: Ratio[];
    seed: number | null;
    background_mode: "preserve" | "replace";
    background_style: string | null;
  };
};
