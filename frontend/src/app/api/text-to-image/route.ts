import { NextRequest, NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";
import { IS_PUBLIC_PREVIEW, PUBLIC_PREVIEW_BLOCKED_MESSAGE } from "@/lib/public-preview";

// 모델명은 시점에 따라 바뀔 수 있습니다. 실패하면 이 값을 huggingface.co에서
// "Inference Providers" 배지가 붙은 최신 이미지 모델로 바꿔보세요.
const HF_MODEL = process.env.HF_IMAGE_MODEL || "stabilityai/stable-diffusion-xl-base-1.0";

export async function POST(req: NextRequest) {
  // UI 숨김만으로는 이 라우트를 직접 호출하는 경로가 남으므로 서버에서 먼저 막는다.
  if (IS_PUBLIC_PREVIEW) {
    return NextResponse.json({ error: PUBLIC_PREVIEW_BLOCKED_MESSAGE }, { status: 403 });
  }

  try {
    const { apiKey, prompt } = await req.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "HuggingFace API 키가 필요합니다." }, { status: 400 });
    }
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "이미지 프롬프트가 필요합니다." }, { status: 400 });
    }

    const client = new InferenceClient(apiKey);
    const imageBlob = await client.textToImage(
      { model: HF_MODEL, inputs: prompt },
      { outputType: "blob" }
    );

    const arrayBuffer = await imageBlob.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: { "Content-Type": imageBlob.type || "image/png" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `이미지 생성 실패: ${message} — 모델 콜드스타트일 수 있으니 잠시 후 다시 시도해보세요.` },
      { status: 500 }
    );
  }
}
