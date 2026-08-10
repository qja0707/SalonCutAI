import { Buffer } from "node:buffer";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const port = 30_000 + Math.floor(Math.random() * 10_000);
const base = `http://127.0.0.1:${port}`;
const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
const nextBin = "node_modules/next/dist/bin/next";

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, SALON_API_MODE: "mock" },
  stdio: "ignore",
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExactKeys(value, keys, message) {
  assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), message);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/v1/health`);
      const body = await response.json();
      if (response.ok && body.status === "ok") return;
    } catch {
      // 서버가 뜨는 동안 재시도한다.
    }
    await sleep(500);
  }
  throw new Error("mock 검증 서버가 준비되지 않았습니다.");
}

const payload = {
  consent: { agreed: true, consent_version: "mock-test-v1" },
  options: {
    ratios: ["1:1", "4:5", "9:16"],
    seed: null,
    background_mode: "preserve",
    background_style: null,
  },
};

const blogPayload = {
  topic: "장마철 슬릭펌 관리법",
  theme: "장마철 곱슬 케어",
  tone: "친근하게",
  domainContext: "20대 여성 고객이 많은 성수동 살롱",
};

async function postFaceSwapJob(scenario, requestPayload = payload) {
  const form = new FormData();
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nL8AAAAASUVORK5CYII=",
    "base64",
  );
  form.append("image", new Blob([pixel], { type: "image/png" }), "test.png");
  form.append("payload", JSON.stringify(requestPayload));
  return fetch(`${base}/api/v1/face-swap-jobs`, {
    method: "POST",
    headers: { "X-Mock-Scenario": scenario },
    body: form,
  });
}

async function createFaceSwapJob(scenario) {
  const response = await postFaceSwapJob(scenario);
  assert(response.status === 202, `${scenario} 생성 응답: ${response.status}`);
  return response.json();
}

async function createBlogJob(scenario) {
  const response = await fetch(`${base}/api/v1/blog-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Mock-Scenario": scenario },
    body: JSON.stringify(blogPayload),
  });
  assert(response.status === 202, `${scenario} 블로그 생성 응답: ${response.status}`);
  const body = await response.json();
  assertExactKeys(body, ["job_id", "test_code", "status", "created_at", "request_id"], "블로그 접수 외피");
  return body;
}

async function verifyConsentValidation() {
  let response = await postFaceSwapJob("normal", {
    ...payload,
    consent: { agreed: false, consent_version: "mock-test-v1" },
  });
  let body = await response.json();
  assert(response.status === 400, `동의 거부 응답: ${response.status}`);
  assert(body.error?.code === "CONSENT_REQUIRED", "동의 거부 오류 코드");

  const payloadWithoutConsent = { options: payload.options };
  response = await postFaceSwapJob("normal", payloadWithoutConsent);
  body = await response.json();
  assert(response.status === 400, `동의 누락 응답: ${response.status}`);
  assert(body.error?.code === "CONSENT_REQUIRED", "동의 누락 오류 코드");
}

async function verify() {
  await waitForServer();
  await verifyConsentValidation();

  let response = await fetch(`${base}/api/v1/blog-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...blogPayload, topic: "" }),
  });
  assert(response.status === 422, `블로그 입력 검증 응답: ${response.status}`);
  const invalidBlog = await response.json();
  assert(invalidBlog.error?.code === "INVALID_BLOG_INPUT", "블로그 입력 오류 코드");
  assert(invalidBlog.error?.retryable === false && invalidBlog.request_id, "블로그 입력 오류 외피");

  const scenarios = ["normal", "image-fail", "face-not-detected"];
  const [faceEntries, blogEntries] = await Promise.all([
    Promise.all(scenarios.map(async (scenario) => [scenario, await createFaceSwapJob(scenario)])),
    Promise.all(["normal", "blog-fail"].map(async (scenario) => [scenario, await createBlogJob(scenario)])),
  ]);
  const created = Object.fromEntries(faceEntries);
  const createdBlogs = Object.fromEntries(blogEntries);

  await sleep(15_500);
  const [jobEntries, blogJobEntries] = await Promise.all([
    Promise.all(
      scenarios.map(async (scenario) => {
        const faceResponse = await fetch(`${base}/api/v1/face-swap-jobs/${created[scenario].job_id}`);
        assert(faceResponse.ok, `${scenario} 조회 응답: ${faceResponse.status}`);
        return [scenario, await faceResponse.json()];
      }),
    ),
    Promise.all(
      ["normal", "blog-fail"].map(async (scenario) => {
        const blogResponse = await fetch(`${base}/api/v1/blog-jobs/${createdBlogs[scenario].job_id}`);
        assert(blogResponse.ok, `${scenario} 블로그 조회 응답: ${blogResponse.status}`);
        return [scenario, await blogResponse.json()];
      }),
    ),
  ]);
  const jobs = Object.fromEntries(jobEntries);
  const blogJobs = Object.fromEntries(blogJobEntries);

  const expected = { normal: "completed", "image-fail": "failed", "face-not-detected": "failed" };
  for (const scenario of scenarios) {
    assert(jobs[scenario].status === expected[scenario], `${scenario}: ${jobs[scenario].status}`);
  }
  assert(typeof jobs.normal.consent_recorded_at === "string", "정상 동의 기록 시각");
  assert(!Number.isNaN(Date.parse(jobs.normal.consent_recorded_at)), "정상 동의 기록 시각 형식");
  assert(jobs["image-fail"].error?.code === "IMAGE_GENERATION_FAILED", "재시도 가능 이미지 오류 코드");
  assert(jobs["image-fail"].error?.retryable === true, "재시도 가능 이미지 retryable");
  assert(jobs["face-not-detected"].error?.code === "FACE_NOT_DETECTED", "얼굴 미검출 오류 코드");
  assert(jobs["face-not-detected"].error?.retryable === false, "얼굴 미검출 retryable");

  assert(blogJobs.normal.status === "completed", `normal 블로그: ${blogJobs.normal.status}`);
  assert(blogJobs["blog-fail"].status === "failed", `blog-fail: ${blogJobs["blog-fail"].status}`);
  assert(blogJobs["blog-fail"].error?.code === "BLOG_GENERATION_FAILED", "블로그 생성 실패 코드");
  assert(blogJobs["blog-fail"].error?.retryable === true, "블로그 생성 실패 retryable");
  assertExactKeys(blogJobs.normal.result, ["title", "intro", "sections", "closing", "hashtags"], "블로그 결과 구조");
  assert(blogJobs.normal.result.sections.every((section) => section.heading && section.body), "블로그 섹션 구조");

  const normalId = created.normal.job_id;
  for (const ratio of ["1x1", "4x5", "9x16"]) {
    const imageResponse = await fetch(`${base}/api/v1/face-swap-jobs/${normalId}/images/${ratio}`);
    assert(imageResponse.ok, `${ratio} 이미지 응답: ${imageResponse.status}`);
    assert(imageResponse.headers.get("content-type")?.startsWith("image/svg+xml"), `${ratio} Content-Type`);
    assert(imageResponse.headers.get("content-disposition")?.includes("filename="), `${ratio} Content-Disposition`);
    assert(imageResponse.headers.get("cache-control") === "no-store", `${ratio} Cache-Control`);
    assert((await imageResponse.arrayBuffer()).byteLength > 100, `${ratio} 이미지 바이트`);
  }

  const retryableId = created["image-fail"].job_id;
  const retryableBlogId = createdBlogs["blog-fail"].job_id;
  const [imageRetryResponse, blogRetryResponse] = await Promise.all([
    fetch(`${base}/api/v1/face-swap-jobs/${retryableId}/retry`, { method: "POST" }),
    fetch(`${base}/api/v1/blog-jobs/${retryableBlogId}/retry`, { method: "POST" }),
  ]);
  assert(imageRetryResponse.status === 202, `이미지 재시도 응답: ${imageRetryResponse.status}`);
  assert(blogRetryResponse.status === 202, `블로그 재시도 응답: ${blogRetryResponse.status}`);
  const blogRetryAccepted = await blogRetryResponse.json();
  assert(blogRetryAccepted.attempt === 2, "블로그 재시도 attempt 증가");

  await sleep(14_500);
  response = await fetch(`${base}/api/v1/face-swap-jobs/${retryableId}`);
  const retried = await response.json();
  assert(retried.status === "completed" && retried.attempt === 2, "이미지 재시도 완료/attempt");
  response = await fetch(`${base}/api/v1/blog-jobs/${retryableBlogId}`);
  const retriedBlog = await response.json();
  assert(retriedBlog.status === "completed" && retriedBlog.attempt === 2, "블로그 재시도 완료/attempt");

  const nonRetryableId = created["face-not-detected"].job_id;
  response = await fetch(`${base}/api/v1/face-swap-jobs/${nonRetryableId}/retry`, { method: "POST" });
  assert(response.status === 409, `재시도 불가 이미지 응답: ${response.status}`);

  response = await fetch(`${base}/api/v1/face-swap-jobs/${normalId}`, { method: "DELETE" });
  assert(response.status === 204, `삭제 응답: ${response.status}`);
  response = await fetch(`${base}/api/v1/face-swap-jobs/${normalId}`);
  assert(response.status === 404, `삭제 후 조회 응답: ${response.status}`);

  const normalBlogId = createdBlogs.normal.job_id;
  response = await fetch(`${base}/api/v1/blog-jobs/${normalBlogId}`, { method: "DELETE" });
  assert(response.status === 204, `블로그 삭제 응답: ${response.status}`);
  response = await fetch(`${base}/api/v1/blog-jobs/${normalBlogId}`);
  assert(response.status === 404, `블로그 삭제 후 조회 응답: ${response.status}`);

  const blogUi = readFileSync(resolve("src/app/generate/blog/blog-generator.tsx"), "utf8");
  const blogCopy = readFileSync(resolve("src/lib/api-client/blog-content.ts"), "utf8");
  const legacyRoute = readFileSync(resolve("src/app/api/generate-blog/route.ts"), "utf8");
  assert(["topic", "theme", "label"].every((key) => blogUi.includes(`searchParams.get("${key}")`)), "블로그 query 진입값 유지");
  assert(!blogUi.includes('provider: "openai"'), "클라이언트 provider 고정값 제거");
  assert(["result.title", "result.intro", "result.sections", "result.closing", "result.hashtags"].every((value) => blogCopy.includes(value)), "복사 문자열 결과 구조 일치");
  assert(legacyRoute.includes("export async function POST"), "기존 /api/generate-blog 유지");

  console.log(
    JSON.stringify(
      {
        statuses: Object.fromEntries(scenarios.map((scenario) => [scenario, jobs[scenario].status])),
        imageRetry: { status: retried.status, attempt: retried.attempt },
        blog: { normal: blogJobs.normal.status, failure: blogJobs["blog-fail"].status },
        blogRetry: { status: retriedBlog.status, attempt: retriedBlog.attempt },
        nonRetryableImage: 409,
        images: 3,
        consent: { rejected: 400, missing: 400, accepted: 202, recordedAt: true },
        delete: { image: 204, blog: 204 },
        invalidBlog: 422,
        uiContract: "ok",
        health: "ok",
      },
      null,
      2,
    ),
  );
}

try {
  await verify();
} finally {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore", timeout: 5_000 });
  } else {
    server.kill("SIGTERM");
  }
  server.unref();
}
