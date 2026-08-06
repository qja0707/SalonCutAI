import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { buildStylePrompt, type StylePromptInput } from "@/lib/style-prompt";
import { resolveApiKey, missingApiKeyMessage } from "@/lib/api-keys";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || "gemini-2.0-flash";

type StyleRecommendation = {
  recommendation: string;
  reasons: string;
  cautions: string;
  imagePrompt: string;
};

async function callOpenAI(apiKey: string, prompt: string): Promise<StyleRecommendation> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(completion.choices[0]?.message?.content ?? "{}");
}

async function callGoogle(apiKey: string, prompt: string): Promise<StyleRecommendation> {
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: GOOGLE_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(response.text ?? "{}");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StylePromptInput & { provider: "openai" | "google"; apiKey?: string };
    const { provider, apiKey: clientApiKey, ...promptInput } = body;

    if (provider !== "openai" && provider !== "google") {
      return NextResponse.json({ error: "provider는 openai 또는 google이어야 합니다." }, { status: 400 });
    }
    const apiKey = resolveApiKey(provider, clientApiKey);
    if (!apiKey) {
      return NextResponse.json({ error: missingApiKeyMessage(provider) }, { status: 400 });
    }

    const prompt = buildStylePrompt(promptInput);
    const result = provider === "openai" ? await callOpenAI(apiKey, prompt) : await callGoogle(apiKey, prompt);

    if (!result.recommendation || !result.imagePrompt) {
      return NextResponse.json({ error: "모델 응답을 파싱하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: `호출 실패: ${message}` }, { status: 500 });
  }
}
