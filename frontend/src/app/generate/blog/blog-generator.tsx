"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, NotebookPen, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DevNote } from "@/components/dev-note";

const TONES = ["친근하게", "차분하게", "발랄하게", "전문적으로"];

type BlogResult = {
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
  closing: string;
  hashtags: string[];
};

export function BlogGenerator() {
  const searchParams = useSearchParams();
  const label = searchParams.get("label");
  const [topic, setTopic] = useState(searchParams.get("topic") ?? "");
  const [theme, setTheme] = useState(searchParams.get("theme") ?? "");

  const [tone, setTone] = useState(TONES[0]);
  const [domainContext, setDomainContext] = useState("");

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<BlogResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!topic) {
      toast.warning("블로그 글감(주제)을 입력해주세요.");
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", topic, theme, tone, domainContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청 실패");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    }
    setGenerating(false);
  }

  function copyAll() {
    if (!result) return;
    const text = [
      result.title,
      "",
      result.intro,
      "",
      ...result.sections.flatMap((s) => [`■ ${s.heading}`, s.body, ""]),
      result.closing,
      "",
      result.hashtags.map((h) => `#${h}`).join(" "),
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("블로그 글을 클립보드에 복사했어요.");
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">📝 AI 블로그 글 생성</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        글감 한 줄로 네이버 블로그·홈페이지에 올릴 정보성 글을 만드는 범용 도구예요. 마케팅 캘린더 등에서
        만든 글감을 그대로 가져와 이어서 생성할 수도 있어요.
      </p>
      {label && (
        <Badge variant="secondary" className="mt-3">
          연결된 컨텍스트 · {label}
        </Badge>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">글감</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">글감(주제)</Label>
                <Textarea
                  rows={3}
                  placeholder="예: 장마철 습도에도 부스스해지지 않는 슬릭펌 효과와 아침 드라이 시간을 줄이는 법"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">관련 테마 (선택)</Label>
                <Input placeholder="예: 장마철 곱슬 케어" value={theme} onChange={(e) => setTheme(e.target.value)} />
              </div>
              <div>
                <Label className="mb-2 block">톤 앤 매너</Label>
                <Select value={tone} onValueChange={(v) => v && setTone(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">우리 샵 소개 (선택)</Label>
                <Textarea
                  placeholder="예: 20대 여성 타겟, 미니멀 감성, 성수동 감성 살롱"
                  value={domainContext}
                  onChange={(e) => setDomainContext(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            블로그 글 만들기
          </Button>
        </div>

        <div>
          <h2 className="mb-4 text-base font-semibold">결과</h2>
          {error && (
            <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>
          )}
          {result ? (
            <div className="space-y-4 rounded-lg border p-4">
              <div>
                <p className="text-lg font-semibold">{result.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{result.intro}</p>
              </div>
              {result.sections.map((s) => (
                <div key={s.heading}>
                  <p className="text-sm font-medium">{s.heading}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">{result.closing}</p>
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map((h) => <Badge key={h} variant="secondary">#{h}</Badge>)}
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={copyAll}>
                <Copy className="h-3.5 w-3.5" /> 블로그 글 전체 복사
              </Button>
            </div>
          ) : (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
              <NotebookPen className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                왼쪽에서 글감을 입력하고 생성하면 블로그 글이 여기 채워집니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <DevNote
        guideExample="가이드 예시 ② · 텍스트 입력만"
        owner="R5 혜리"
        engines={["OpenAI (실제 연동됨, 서버 .env의 OPENAI_API_KEY 사용)"]}
        preserve=""
        change="블로그 글 전체"
        steps={[
          "사용자가 글감·톤·샵 소개를 입력 (API 키 입력 없음)",
          "/api/generate-blog로 { provider: \"openai\", topic, theme, tone, domainContext } POST",
          "서버가 resolveApiKey()로 .env의 OPENAI_API_KEY를 사용하고, buildPrompt()로 프롬프트를 조립",
          "OpenAI(gpt-4o-mini, OPENAI_MODEL로 교체 가능)를 JSON 모드로 실제 호출",
          "title/intro/sections/closing/hashtags JSON을 그대로 화면에 렌더링",
        ]}
        codeHint={`// /api/generate-blog/route.ts — OpenAI/Gemini 실제 호출\n// 다른 페이지에서 /generate/blog?topic=...&theme=...&label=... 로 링크하면 글감이 자동 채워짐`}
      />
    </div>
  );
}
