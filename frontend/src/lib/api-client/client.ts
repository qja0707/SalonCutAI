import type {
  CreateJobPayload,
  CreateJobResponse,
  ErrorEnvelope,
  JobResponse,
  MockScenario,
  RetryJobResponse,
} from "@/lib/api-client/types";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | ErrorEnvelope | null;
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data
      ? (data as ErrorEnvelope).error.message
      : `요청에 실패했습니다. (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function createJob(
  image: File,
  payload: CreateJobPayload,
  scenario: MockScenario = "normal",
): Promise<CreateJobResponse> {
  const form = new FormData();
  form.append("image", image);
  form.append("payload", JSON.stringify(payload));

  return parseResponse<CreateJobResponse>(
    await fetch("/api/v1/jobs", {
      method: "POST",
      headers: { "X-Mock-Scenario": scenario },
      body: form,
    }),
  );
}

export async function getJob(jobId: string): Promise<JobResponse> {
  return parseResponse<JobResponse>(await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" }));
}

export async function retryJob(
  jobId: string,
  components: ("image" | "blog")[],
): Promise<RetryJobResponse> {
  return parseResponse<RetryJobResponse>(
    await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ components }),
    }),
  );
}

export async function deleteJob(jobId: string): Promise<void> {
  const response = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
  if (!response.ok) await parseResponse<never>(response);
}
