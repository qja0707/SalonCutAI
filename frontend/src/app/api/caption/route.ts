import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { resolveApiKey, missingApiKeyMessage } from "@/lib/api-keys";

// 모델명은 시점에 따라 바뀔 수 있습니다. 호출이 실패하면 이 두 값을 최신 모델명으로 바꿔보세요.
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || "gemini-2.0-flash";

type CopyResult = { cardCopy: string; hook: string; design: string; cta: string };

function buildPrompt(domainContext: string, tone: string) {
  return `너는 동네 미용실의 SNS 마케팅 카피라이터야. 아래 조건으로 두 가지를 각각 작성해.

톤 앤 매너: ${tone}
샵 소개(도메인 지식): ${domainContext || "정보 없음 — 일반적인 미용실 기준으로 작성"}

1) 카드뉴스 이미지 안에 들어갈 아주 짧은 문구 (시술명 + 핵심 포인트, 10~20자 내외, 이미지에 오버레이될 텍스트라 짧아야 함)
2) 인스타그램 게시글 캡션 (이미지엔 포함 안 되고 게시글 본문으로 따로 올라감, 3단락)

반드시 아래 JSON 형식으로만 응답해:
{
  "cardCopy": "카드 이미지에 들어갈 짧은 문구 (10~20자)",
  "hook": "캡션 1단락 - 시선을 끄는 훅 문구 (1~2문장)",
  "design": "캡션 2단락 - 시술/디자인 특징 설명 (색감·질감·스타일 포인트, 2~3문장)",
  "cta": "캡션 3단락 - 예약을 유도하는 CTA (프로필 링크 예약, DM 문의 등, 1~2문장)"
}`;
}

async function callOpenAI(apiKey: string, domainContext: string, tone: string): Promise<CopyResult> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildPrompt(domainContext, tone) }],
  });
  const text = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

async function callGoogle(apiKey: string, domainContext: string, tone: string): Promise<CopyResult> {
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: GOOGLE_MODEL,
    contents: buildPrompt(domainContext, tone),
    config: { responseMimeType: "application/json" },
  });
  const text = response.text ?? "{}";
  return JSON.parse(text);
}

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey: clientApiKey, domainContext, tone } = await req.json();

    if (provider !== "openai" && provider !== "google") {
      return NextResponse.json({ error: "provider는 openai 또는 google이어야 합니다." }, { status: 400 });
    }
    const apiKey = resolveApiKey(provider, clientApiKey);
    if (!apiKey) {
      return NextResponse.json({ error: missingApiKeyMessage(provider) }, { status: 400 });
    }

    const result =
      provider === "openai"
        ? await callOpenAI(apiKey, domainContext ?? "", tone ?? "차분하게")
        : await callGoogle(apiKey, domainContext ?? "", tone ?? "차분하게");

    if (!result.cardCopy || !result.hook || !result.design || !result.cta) {
      return NextResponse.json(
        { error: "모델 응답을 파싱하지 못했습니다. 잠시 후 다시 시도해주세요." },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: `호출 실패: ${message}` }, { status: 500 });
  }
}
