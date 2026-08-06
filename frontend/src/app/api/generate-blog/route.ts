import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { resolveApiKey, missingApiKeyMessage } from "@/lib/api-keys";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || "gemini-2.0-flash";

type BlogResult = {
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
  closing: string;
  hashtags: string[];
};

function buildPrompt(topic: string, theme: string, tone: string, domainContext: string) {
  return `너는 동네 미용실의 네이버 블로그·인스타그램 마케팅 콘텐츠 작가야. 아래 조건으로 블로그 게시글 한 편을 작성해.

${theme ? `관련 테마: ${theme}\n` : ""}글감(주제): ${topic}
톤 앤 매너: ${tone}
샵 소개(도메인 지식): ${domainContext || "정보 없음 — 일반적인 동네 미용실 기준으로 작성"}

블로그 글은 소제목 2~3개로 구성된 본문을 포함해야 하고, 실제 방문 고객이 검색해서 들어올 법한 정보성 내용과
자연스러운 예약 유도를 함께 담아야 해. 과장 광고 문구는 피하고 신뢰감 있게 작성해.

반드시 아래 JSON 형식으로만 응답해:
{
  "title": "블로그 제목 (SEO를 고려한 20~40자, 흥미를 끌면서 구체적인 제목)",
  "intro": "도입부 (2~3문장, 고객 공감대 형성)",
  "sections": [
    { "heading": "소제목 1", "body": "본문 문단 (3~5문장)" },
    { "heading": "소제목 2", "body": "본문 문단 (3~5문장)" }
  ],
  "closing": "마무리 문단 (예약·방문 유도, 2~3문장)",
  "hashtags": ["해시태그1", "해시태그2", "해시태그3", "해시태그4", "해시태그5"]
}`;
}

async function callOpenAI(apiKey: string, ...args: [string, string, string, string]): Promise<BlogResult> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildPrompt(...args) }],
  });
  return JSON.parse(completion.choices[0]?.message?.content ?? "{}");
}

async function callGoogle(apiKey: string, ...args: [string, string, string, string]): Promise<BlogResult> {
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
    const { provider, apiKey: clientApiKey, topic, theme, tone, domainContext } = await req.json();

    if (provider !== "openai" && provider !== "google") {
      return NextResponse.json({ error: "provider는 openai 또는 google이어야 합니다." }, { status: 400 });
    }
    const apiKey = resolveApiKey(provider, clientApiKey);
    if (!apiKey) {
      return NextResponse.json({ error: missingApiKeyMessage(provider) }, { status: 400 });
    }
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "topic이 필요합니다." }, { status: 400 });
    }

    const args: [string, string, string, string] = [topic, theme ?? "", tone ?? "친근하게", domainContext ?? ""];
    const result = provider === "openai" ? await callOpenAI(apiKey, ...args) : await callGoogle(apiKey, ...args);

    if (!result.title || !result.sections?.length) {
      return NextResponse.json({ error: "모델 응답을 파싱하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: `호출 실패: ${message}` }, { status: 500 });
  }
}
