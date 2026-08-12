import { NextResponse } from "next/server";
import {
  FACE_PROMPT_OPTIONAL_KEYS,
  FACE_PROMPT_REQUIRED_KEYS,
  type CreateFaceSwapJobPayload,
} from "@/lib/api-client/types";
import { FACE_CUSTOM_MAX, FACE_REQUIRED_ALLOWED } from "@/lib/face-taxonomy";
import { getApiMode } from "@/lib/api-client/server/mode";
import {
  createMockFaceSwapJob,
  hasMockReferenceFace,
  parseMockScenario,
} from "@/lib/api-client/server/mock-store";
import { errorResponse, proxyPendingResponse } from "@/lib/api-client/server/response";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_RATIOS = new Set(["1:1", "4:5", "9:16"]);

/**
 * 얼굴 옵션 검증. 규칙은 하나다 — 쓰는 쪽만 채우고 반대쪽은 null.
 * 보기값도 함께 확인한다. 목록에 없는 문자열이 프롬프트로 들어가면 결과가 망가진다.
 */
function isFaceOption(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const face = value as { mode?: unknown; prompt?: unknown; reference?: unknown };

  if (face.mode === "reference") {
    if (face.prompt !== null) return false;
    const reference = face.reference as { reference_face_id?: unknown } | null;
    return Boolean(
      reference &&
        typeof reference.reference_face_id === "string" &&
        hasMockReferenceFace(reference.reference_face_id),
    );
  }

  if (face.mode === "prompt") {
    if (face.reference !== null) return false;
    const prompt = face.prompt as Record<string, unknown> | null;
    if (!prompt || typeof prompt !== "object") return false;
    // 필수 3개는 고정 목록에서만 온다. 얼굴의 뼈대를 정하는 값이라 흔들리면 안 된다.
    const required = FACE_PROMPT_REQUIRED_KEYS.every((key) => {
      const entry = prompt[key];
      return typeof entry === "string" && (FACE_REQUIRED_ALLOWED[key] as readonly string[]).includes(entry);
    });
    // 세부 3개는 직접 입력을 열어둬서 목록 대조를 하지 않는다. 길이만 막는다 —
    // 문단을 통째로 붙여넣으면 프롬프트가 엉킨다.
    const optional = FACE_PROMPT_OPTIONAL_KEYS.every((key) => {
      const entry = prompt[key];
      return typeof entry === "string" && entry.length <= FACE_CUSTOM_MAX;
    });
    return required && optional;
  }

  return false;
}

function isPayload(value: unknown): value is CreateFaceSwapJobPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<CreateFaceSwapJobPayload>;
  const ratios = payload.options?.ratios;
  const backgroundMode = payload.options?.background_mode;
  const backgroundStyle = payload.options?.background_style;
  return (
    payload.consent?.agreed === true &&
    typeof payload.consent.consent_version === "string" &&
    Array.isArray(ratios) &&
    ratios.length > 0 &&
    ratios.every((ratio) => ALLOWED_RATIOS.has(ratio)) &&
    new Set(ratios).size === ratios.length &&
    (payload.options?.seed === null || typeof payload.options?.seed === "number") &&
    ((backgroundMode === "preserve" && backgroundStyle === null) ||
      (backgroundMode === "replace" && typeof backgroundStyle === "string" && backgroundStyle.length > 0)) &&
    isFaceOption(payload.options?.face)
  );
}

export async function POST(request: Request) {
  if (getApiMode() === "proxy") {
    // TODO(MOCK-001 후속): 인증·HTTPS가 준비된 VM API 프록시를 이 경계에 연결한다.
    return proxyPendingResponse(request);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return errorResponse(422, "INVALID_FACE_SWAP_INPUT", "얼굴 교체 입력을 확인해주세요.");

  const image = form.get("image");
  const payloadText = form.get("payload");
  if (!(image instanceof File)) return errorResponse(400, "INVALID_IMAGE_TYPE", "JPG, PNG 또는 WEBP 사진을 사용해주세요.");
  if (typeof payloadText !== "string") return errorResponse(422, "INVALID_FACE_SWAP_INPUT", "얼굴 교체 옵션을 확인해주세요.");
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return errorResponse(400, "INVALID_IMAGE_TYPE", "JPG, PNG 또는 WEBP 사진을 사용해주세요.");
  }
  if (image.size > MAX_UPLOAD_BYTES) {
    return errorResponse(413, "IMAGE_TOO_LARGE", "사진 용량은 10MB 이하로 줄여주세요.");
  }

  const payload = await Promise.resolve().then(() => JSON.parse(payloadText) as unknown).catch(() => null);
  if (!payload || typeof payload !== "object" || (payload as Partial<CreateFaceSwapJobPayload>).consent?.agreed !== true) {
    return errorResponse(400, "CONSENT_REQUIRED", "사진 활용 동의를 확인해주세요.");
  }
  if (!isPayload(payload)) return errorResponse(422, "INVALID_FACE_SWAP_INPUT", "얼굴 교체 옵션을 확인해주세요.");

  const scenario = parseMockScenario(request.headers.get("X-Mock-Scenario"));
  return NextResponse.json(createMockFaceSwapJob(scenario), {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}
