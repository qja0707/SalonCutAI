import { spawn, spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";

const port = 30_000 + Math.floor(Math.random() * 10_000);
const base = `http://127.0.0.1:${port}`;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const nextBin = "node_modules/next/dist/bin/next";

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, SALON_API_MODE: "mock" },
  stdio: "ignore",
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  consent: { agreed: true, consent_version: "2026-08-07" },
  options: {
    ratios: ["1:1", "4:5", "9:16"],
    seed: null,
    background_mode: "preserve",
    background_style: null,
  },
};

async function createFaceSwapJob(scenario) {
  const form = new FormData();
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nL8AAAAASUVORK5CYII=",
    "base64",
  );
  form.append("image", new Blob([pixel], { type: "image/png" }), "test.png");
  form.append("payload", JSON.stringify(payload));
  const response = await fetch(`${base}/api/v1/face-swap-jobs`, {
    method: "POST",
    headers: { "X-Mock-Scenario": scenario },
    body: form,
  });
  assert(response.status === 202, `${scenario} 생성 응답: ${response.status}`);
  return response.json();
}

async function verify() {
  await waitForServer();
  const scenarios = ["normal", "image-fail", "face-not-detected"];
  const entries = await Promise.all(scenarios.map(async (scenario) => [scenario, await createFaceSwapJob(scenario)]));
  const created = Object.fromEntries(entries);

  await sleep(15_500);
  const jobEntries = await Promise.all(
    scenarios.map(async (scenario) => {
      const response = await fetch(`${base}/api/v1/face-swap-jobs/${created[scenario].job_id}`);
      assert(response.ok, `${scenario} 조회 응답: ${response.status}`);
      return [scenario, await response.json()];
    }),
  );
  const jobs = Object.fromEntries(jobEntries);
  const expected = { normal: "completed", "image-fail": "failed", "face-not-detected": "failed" };
  for (const scenario of scenarios) {
    assert(jobs[scenario].status === expected[scenario], `${scenario}: ${jobs[scenario].status}`);
  }
  assert(jobs["image-fail"].error?.code === "IMAGE_GENERATION_FAILED", "재시도 가능 이미지 오류 코드");
  assert(jobs["image-fail"].error?.retryable === true, "재시도 가능 이미지 retryable");
  assert(jobs["face-not-detected"].error?.code === "FACE_NOT_DETECTED", "얼굴 미검출 오류 코드");
  assert(jobs["face-not-detected"].error?.retryable === false, "얼굴 미검출 retryable");

  const normalId = created.normal.job_id;
  for (const ratio of ["1x1", "4x5", "9x16"]) {
    const response = await fetch(`${base}/api/v1/face-swap-jobs/${normalId}/images/${ratio}`);
    assert(response.ok, `${ratio} 이미지 응답: ${response.status}`);
    assert(response.headers.get("content-type")?.startsWith("image/svg+xml"), `${ratio} Content-Type`);
    assert(response.headers.get("content-disposition")?.includes("filename="), `${ratio} Content-Disposition`);
    assert(response.headers.get("cache-control") === "no-store", `${ratio} Cache-Control`);
    assert((await response.arrayBuffer()).byteLength > 100, `${ratio} 이미지 바이트`);
  }

  const retryableId = created["image-fail"].job_id;
  let response = await fetch(`${base}/api/v1/face-swap-jobs/${retryableId}/retry`, { method: "POST" });
  assert(response.status === 202, `이미지 재시도 응답: ${response.status}`);
  await sleep(14_500);
  response = await fetch(`${base}/api/v1/face-swap-jobs/${retryableId}`);
  const retried = await response.json();
  assert(retried.status === "completed" && retried.attempt === 2, "이미지 재시도 완료/attempt");

  const nonRetryableId = created["face-not-detected"].job_id;
  response = await fetch(`${base}/api/v1/face-swap-jobs/${nonRetryableId}/retry`, { method: "POST" });
  assert(response.status === 409, `재시도 불가 이미지 응답: ${response.status}`);

  response = await fetch(`${base}/api/v1/face-swap-jobs/${normalId}`, { method: "DELETE" });
  assert(response.status === 204, `삭제 응답: ${response.status}`);
  response = await fetch(`${base}/api/v1/face-swap-jobs/${normalId}`);
  assert(response.status === 404, `삭제 후 조회 응답: ${response.status}`);

  console.log(
    JSON.stringify(
      {
        statuses: Object.fromEntries(scenarios.map((scenario) => [scenario, jobs[scenario].status])),
        imageRetry: { status: retried.status, attempt: retried.attempt },
        nonRetryableImage: 409,
        images: 3,
        delete: 204,
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
