import { NextRequest, NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";

// 모델명은 시점에 따라 바뀔 수 있습니다. 실패하면 이 값을 huggingface.co에서
// "Inference Providers" 배지가 붙은 최신 이미지 모델로 바꿔보세요.
const HF_MODEL = process.env.HF_IMAGE_MODEL || "stabilityai/stable-diffusion-xl-base-1.0";

// TODO(R2/R4): 얼굴 마스크(MediaPipe 등)가 붙으면 image_to_image 대신
// inpainting 전용 호출로 교체하고, mask 파라미터를 추가하세요.
// 지금은 마스킹 없이 사진 전체를 변환합니다 — "얼굴만" 정밀 변환은 아직 아닙니다.

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const apiKey = formData.get("apiKey");
    const prompt = formData.get("prompt");
    const strength = formData.get("strength");
    const image = formData.get("image");

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "HuggingFace API 키가 필요합니다." }, { status: 400 });
    }
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
    }

    const client = new InferenceClient(apiKey);
    const imageBlob = await client.imageToImage({
      model: HF_MODEL,
      inputs: image,
      parameters: {
        prompt: typeof prompt === "string" && prompt ? prompt : "a different person, natural, photorealistic, same pose and background",
        strength: typeof strength === "string" ? Number(strength) : 0.55,
      },
    });

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
