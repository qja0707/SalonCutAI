import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { resolveApiKey, missingApiKeyMessage } from "@/lib/api-keys";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || "gemini-2.0-flash";

type BannerResult = { headline: string; subtext: string; hashtags: string[] };

function buildPrompt(season: string, personalColor: string, purpose: string, domainContext: string) {
  return `너는 동네 미용실의 SNS 마케팅 카피라이터야. 사진 없이 텍스트만으로 ${purpose}를 만들 거야.

시즌: ${season}
퍼스널컬러 테마: ${personalColor}
샵 소개: ${domainContext || "정보 없음 — 일반적인 미용실 기준으로 작성"}

반드시 아래 JSON 형식으로만 응답해:
{
  "headline": "배너 큰 제목 (8~16자, 시즌과 퍼스널컬러가 느껴지게)",
  "subtext": "배너 부제 (15~30자, 구체적인 혜택이나 시술 제안)",
  "hashtags": ["해시태그1", "해시태그2", "해시태그3", "해시태그4"]
}`;
}

async function callOpenAI(apiKey: string, ...args: [string, string, string, string]): Promise<BannerResult> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildPrompt(...args) }],
  });
  return JSON.parse(completion.choices[0]?.message?.content ?? "{}");
}

async function callGoogle(apiKey: string, ...args: [string, string, string, string]): Promise<BannerResult> {
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: GOOGLE_MODEL,
    contents: buildPrompt(...args),
    config: { responseMimeType: "application/json" },
  });
  return JSON.parse(response.text ?? "{}");
}

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey: clientApiKey, season, personalColor, purpose, domainContext } = await req.json();

    if (provider !== "openai" && provider !== "google") {
      return NextResponse.json({ error: "provider는 openai 또는 google이어야 합니다." }, { status: 400 });
    }
    const apiKey = resolveApiKey(provider, clientApiKey);
    if (!apiKey) {
      return NextResponse.json({ error: missingApiKeyMessage(provider) }, { status: 400 });
    }

    const args: [string, string, string, string] = [season, personalColor, purpose, domainContext ?? ""];
    const result = provider === "openai" ? await callOpenAI(apiKey, ...args) : await callGoogle(apiKey, ...args);

    if (!result.headline || !result.subtext) {
      return NextResponse.json({ error: "모델 응답을 파싱하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: `호출 실패: ${message}` }, { status: 500 });
  }
}
