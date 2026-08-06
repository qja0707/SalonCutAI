"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DevNote } from "@/components/dev-note";

const TONES = ["차분하게", "발랄하게", "전문적으로", "친근하게"];

type CaptionResult = { cardCopy: string; hook: string; design: string; cta: string };

export function CaptionGenerator() {
  const searchParams = useSearchParams();
  const label = searchParams.get("label");
  const [domainContext, setDomainContext] = useState(searchParams.get("context") ?? "");
  const [tone, setTone] = useState(searchParams.get("tone") ?? TONES[0]);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", domainContext, tone }),
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
    const text = `${result.hook}\n\n${result.design}\n\n${result.cta}`;
    navigator.clipboard.writeText(text);
    toast.success("캡션을 클립보드에 복사했어요.");
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">📸 AI 인스타 캡션 생성</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        시술 사진에 곁들일 카드 문구와 인스타그램 캡션을 만드는 범용 도구예요. 얼굴 교체 등 다른 기능에서
        만든 시술 설명을 그대로 가져와 이어서 생성할 수도 있어요.
      </p>
      {label && (
        <Badge variant="secondary" className="mt-3">
          연결된 컨텍스트 · {label}
        </Badge>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">내용</CardTitle></CardHeader>
            <CardContent className="space-y-4">
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
                <Label className="mb-2 block">시술·샵 소개 (선택)</Label>
                <Textarea
                  placeholder="예: 가을 웜톤 브라운 펌, 20대 여성 타겟, 성수동 감성 살롱"
                  value={domainContext}
                  onChange={(e) => setDomainContext(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            캡션 만들기
          </Button>
        </div>

        <div>
          <h2 className="mb-4 text-base font-semibold">결과</h2>
          {error && (
            <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>
          )}
          {result ? (
            <div className="space-y-3">
              <Alert className="border-primary/30 bg-primary/5">
                <AlertDescription className="text-base font-medium">{result.cardCopy}</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <CaptionBlock label="훅 (1단락)" text={result.hook} />
                <CaptionBlock label="디자인 설명 (2단락)" text={result.design} />
                <CaptionBlock label="CTA (3단락)" text={result.cta} />
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={copyAll}>
                <Copy className="h-3.5 w-3.5" /> 캡션 전체 복사
              </Button>
            </div>
          ) : (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                왼쪽에서 톤과 내용을 입력하고 생성하면 카드 문구와 인스타 캡션이 여기 채워집니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <DevNote
        guideExample="가이드 예시 ② · 텍스트 입력만"
        owner="R3 규범"
        engines={["OpenAI (실제 연동됨, 서버 .env의 OPENAI_API_KEY 사용)"]}
        preserve=""
        change="카드 문구 + 인스타 캡션"
        steps={[
          "사용자가 톤·시술/샵 소개를 입력 (API 키 입력 없음)",
          "/api/caption으로 { provider: \"openai\", domainContext, tone } POST",
          "서버가 resolveApiKey()로 .env의 OPENAI_API_KEY를 사용해 프롬프트 조립 후 OpenAI 실제 호출",
          "cardCopy(이미지용 짧은 문구)/hook/design/cta JSON 응답을 화면에 렌더링",
        ]}
        codeHint={`// /api/caption/route.ts — OpenAI/Gemini 실제 호출\n// 다른 페이지에서 /generate/caption?context=...&label=... 로 링크하면 내용이 자동 채워짐`}
      />
    </div>
  );
}

function CaptionBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{text}</p>
    </div>
  );
}
