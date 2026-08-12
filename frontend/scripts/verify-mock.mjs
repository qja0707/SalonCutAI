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

// 얼굴 옵션은 쓰는 쪽만 채우고 반대쪽은 null 이다. 기본 검사는 참조 모드로 돈다.
const referenceFace = {
  mode: "reference",
  reference: { reference_face_id: "ref-01" },
  prompt: null,
};

const promptFace = {
  mode: "prompt",
  reference: null,
  prompt: {
    ethnicity: "한국인",
    gender: "여성",
    age: "20대",
    face_style: "",
    expression: "",
    skin_tone: "",
    makeup: "",
  },
};

const payload = {
  consent: { agreed: true, consent_version: "mock-test-v1" },
  options: {
    ratios: ["1:1", "4:5", "9:16"],
    seed: null,
    background_mode: "preserve",
    background_style: null,
    face: referenceFace,
  },
};

function withFace(face) {
  return { ...payload, options: { ...payload.options, face } };
}

// 백엔드 BlogGenerationRequest 와 같은 12필드.
// special_product 를 빈 문자열로 두어, 선택 필드 미입력이 접수되는 것도 함께 검사한다.
const blogPayload = {
  hair_length: "단발",
  hair_texture: "직모",
  hair_thickness: "가는 편",
  damage_level: "약간 손상",
  customer_pain_point: "모발이 얇고 힘이 없어 아침마다 정수리가 눌렸습니다",
  base_cut: "레이어드 컷",
  main_treatment: "C컬 펌",
  design_point: "얼굴형을 보완하는 C컬 볼륨",
  designer_name: "김서연",
  duration_minutes: "120",
  special_product: "",
  region_keyword: "성수동 미용실",
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

async function verifyReferenceFaces() {
  const response = await fetch(`${base}/api/v1/reference-faces`);
  assert(response.ok, `참조 얼굴 목록 응답: ${response.status}`);
  const body = await response.json();
  assert(Array.isArray(body.items) && body.items.length > 0, "참조 얼굴 목록 비어 있음");
  assert(typeof body.request_id === "string", "참조 얼굴 목록 request_id");
  assertExactKeys(
    body.items[0],
    ["id", "label", "gender", "ethnicity", "age_group", "thumbnail_url"],
    "참조 얼굴 항목 구조",
  );

  const thumbnail = await fetch(`${base}${body.items[0].thumbnail_url}`);
  assert(thumbnail.ok, `참조 얼굴 썸네일 응답: ${thumbnail.status}`);
  assert(thumbnail.headers.get("content-type")?.startsWith("image/svg+xml"), "참조 얼굴 썸네일 Content-Type");
  assert((await thumbnail.arrayBuffer()).byteLength > 100, "참조 얼굴 썸네일 바이트");

  const missing = await fetch(`${base}/api/v1/reference-faces/ref-unknown/thumbnail`);
  assert(missing.status === 404, `없는 참조 얼굴 썸네일 응답: ${missing.status}`);

  return body.items.length;
}

/** 얼굴 옵션이 없거나 규칙을 어기면 접수되지 않아야 한다. */
async function verifyFaceOptionValidation() {
  const noFaceOptions = { ...payload.options };
  delete noFaceOptions.face;
  const cases = [
    ["얼굴 옵션 누락", { ...payload, options: noFaceOptions }],
    // 반대쪽을 null 로 비우지 않으면 어느 값을 써야 할지 모호해진다.
    ["양쪽 동시 지정", withFace({ ...referenceFace, prompt: promptFace.prompt })],
    ["없는 참조 얼굴", withFace({ ...referenceFace, reference: { reference_face_id: "ref-unknown" } })],
    ["목록에 없는 국적", withFace({ ...promptFace, prompt: { ...promptFace.prompt, ethnicity: "화성인" } })],
    ["필수 연령대 누락", withFace({ ...promptFace, prompt: { ...promptFace.prompt, age: "" } })],
    // 세부도 고정 목록만 받는다(8/12). 목록 밖 한글은 백엔드 매핑표에서 못 찾고
    // 에러 없이 그 값만 빠지므로, 프론트에서 먼저 막아야 한다.
    ["목록에 없는 세부 값", withFace({ ...promptFace, prompt: { ...promptFace.prompt, makeup: "스모키" } })],
    ["옛 연령대 값", withFace({ ...promptFace, prompt: { ...promptFace.prompt, age: "20대 초반" } })],
  ];

  for (const [name, invalidPayload] of cases) {
    const response = await postFaceSwapJob("normal", invalidPayload);
    const body = await response.json();
    assert(response.status === 422, `${name} 응답: ${response.status}`);
    assert(body.error?.code === "INVALID_FACE_SWAP_INPUT", `${name} 오류 코드`);
  }

  // 세부 4개를 비워둔 prompt 모드는 정상 접수된다. 빈 문자열이 "선택 안 함"이다.
  const accepted = await postFaceSwapJob("normal", withFace(promptFace));
  assert(accepted.status === 202, `prompt 모드 접수 응답: ${accepted.status}`);

  // 세부를 목록 안 값으로 채우면 접수된다. 표정·스킨 톤은 8/12 에 새로 생긴 축이다.
  const filled = await postFaceSwapJob(
    "normal",
    withFace({
      ...promptFace,
      prompt: {
        ...promptFace.prompt,
        face_style: "고양이상",
        expression: "도도한",
        skin_tone: "태닝 톤",
        makeup: "말린 장미",
      },
    }),
  );
  assert(filled.status === 202, `세부 전체 선택 접수 응답: ${filled.status}`);
}

async function verify() {
  await waitForServer();
  await verifyConsentValidation();
  const referenceFaceCount = await verifyReferenceFaces();
  await verifyFaceOptionValidation();

  let response = await fetch(`${base}/api/v1/blog-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...blogPayload, main_treatment: "" }),
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
  assertExactKeys(blogJobs.normal.result.sections, ["before", "process", "after", "home_care"], "블로그 섹션 키");
  assert(Object.values(blogJobs.normal.result.sections).every((section) => section.heading && section.body), "블로그 섹션 구조");

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

  const faceUi = readFileSync(resolve("src/app/face-swap/page.tsx"), "utf8");
  const faceForm = readFileSync(resolve("src/components/face-option-form.tsx"), "utf8");
  assert(faceUi.includes("buildFaceOption(face)"), "얼굴 옵션을 payload 로 전송");
  assert(faceUi.includes("!isFaceReady(face)"), "얼굴 미선택 시 제출 차단");
  // 자유 입력은 닫혔다(8/12). 입력칸이 되살아나면 목록 밖 값이 다시 새어 나간다.
  assert(!faceForm.includes("직접 입력"), "세부 자유 입력 제거");
  assert(faceForm.includes("FACE_EXPRESSIONS"), "표정 축 노출");
  // 필수 3개와 세부 4개 모두 고정 목록만 받는다. 서버가 목록을 대조하는지 확인한다.
  const faceRoute = readFileSync(resolve("src/app/api/v1/face-swap-jobs/route.ts"), "utf8");
  assert(faceRoute.includes("FACE_REQUIRED_ALLOWED"), "필수 얼굴 옵션 목록 대조");
  assert(faceRoute.includes("FACE_OPTIONAL_ALLOWED"), "세부 얼굴 옵션 목록 대조");
  // 배경 교체는 기능 2로 넘어갔다. 토글이 되살아나면 지원하지 않는 모드가 나간다.
  assert(faceUi.includes("BACKGROUND_REPLACE_READY = false"), "배경 교체 토글 비활성");

  const blogUi = readFileSync(resolve("src/app/generate/blog/blog-generator.tsx"), "utf8");
  const blogCopy = readFileSync(resolve("src/lib/api-client/blog-content.ts"), "utf8");
  const apiClient = readFileSync(resolve("src/lib/api-client/client.ts"), "utf8");
  const legacyRoute = readFileSync(resolve("src/app/api/generate-blog/route.ts"), "utf8");
  const blogFields = readFileSync(resolve("src/app/generate/blog/blog-fields.tsx"), "utf8");
  assert(blogUi.includes('searchParams.get("label")'), "블로그 연결 컨텍스트 배지 유지");
  assert(blogUi.includes("buildBlogPayload(fields, profile)"), "12필드 payload 로 전송");
  assert(blogUi.includes("isBlogFieldsReady(fields)"), "필수 4개 미입력 시 제출 차단");
  assert(!blogUi.includes("BLOG_TONES"), "톤 앤 매너 입력 제거 (12필드에 없음)");
  assert(blogFields.includes("formatDuration"), "소요 시간 표시값과 전송값 분리");
  assert(blogFields.includes("buildRegionKeyword"), "region_keyword 지역+업종 조합");
  assert(!blogUi.includes('provider: "openai"'), "클라이언트 provider 고정값 제거");
  assert(["result.title", "result.intro", "result.sections", "result.closing", "result.hashtags"].every((value) => blogCopy.includes(value)), "복사 문자열 결과 구조 일치");
  assert(blogCopy.includes("<p><br></p>"), "네이버 블록 사이 빈 문단 유지");
  assert(!blogCopy.includes("<h3>"), "네이버에서 본문 크기로 바뀌는 h3 미사용");
  assert(apiClient.includes("BLOG_SECTION_ORDER.map"), "블로그 전송 객체를 화면 배열로 변환");
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
        referenceFaces: referenceFaceCount,
        faceOption: { invalidCases: 422, promptAccepted: 202 },
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
