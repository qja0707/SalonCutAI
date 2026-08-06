"use client";

import { useState } from "react";
import { Loader2, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DevNote } from "@/components/dev-note";

const SEASONS = ["2026 S/S", "2026 F/W"];
const PERSONAL_COLORS = ["봄웜", "여름쿨", "가을웜", "겨울쿨"] as const;
const PURPOSES = ["시즌 프로모션 배너", "메뉴판"];

const COLOR_STYLE: Record<(typeof PERSONAL_COLORS)[number], { bg: string; text: string; sub: string }> = {
  봄웜: { bg: "linear-gradient(135deg, #FFB37B 0%, #FF8A65 100%)", text: "#3D1F0A", sub: "#5C2E10" },
  여름쿨: { bg: "linear-gradient(135deg, #C9D6FF 0%, #A0C4FF 100%)", text: "#1B2A4A", sub: "#33456B" },
  가을웜: { bg: "linear-gradient(135deg, #D99A5B 0%, #B5651D 100%)", text: "#2E1706", sub: "#4A2A10" },
  겨울쿨: { bg: "linear-gradient(135deg, #2B3A67 0%, #0F1B3D 100%)", text: "#FFFFFF", sub: "#C9D6FF" },
};

type BannerResult = { headline: string; subtext: string; hashtags: string[] };

export default function SeasonBannerPage() {
  const [season, setSeason] = useState(SEASONS[0]);
  const [personalColor, setPersonalColor] = useState<(typeof PERSONAL_COLORS)[number]>("봄웜");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [domainContext, setDomainContext] = useState("");

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<BannerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/banner-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", season, personalColor, purpose, domainContext }),
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
    const text = `${result.headline}\n${result.subtext}\n\n${result.hashtags.map((h) => `#${h}`).join(" ")}`;
    navigator.clipboard.writeText(text);
    toast.success("클립보드에 복사했어요.");
  }

  const style = COLOR_STYLE[personalColor];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">🏷️ 시즌 배너 · 메뉴판</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        사진 없이 문구만으로 시즌 배너나 메뉴판을 만듭니다. 시즌·퍼스널컬러를 고르면 그 느낌에 맞는
        문구를 실제 LLM이 만들어드려요.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">1. 컨셉</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">시즌</Label>
                <RadioGroup value={season} onValueChange={setSeason} className="flex gap-4">
                  {SEASONS.map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <RadioGroupItem value={s} id={s} />
                      <Label htmlFor={s} className="font-normal">{s}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label className="mb-2 block">퍼스널컬러</Label>
                <div className="flex flex-wrap gap-2">
                  {PERSONAL_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPersonalColor(c)}
                      className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors"
                      style={{
                        borderColor: personalColor === c ? "var(--color-primary)" : "var(--border)",
                        background: personalColor === c ? "var(--accent)" : "transparent",
                      }}
                    >
                      <span className="h-3.5 w-3.5 rounded-full" style={{ background: COLOR_STYLE[c].bg }} />
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">산출물 종류</Label>
                <Select value={purpose} onValueChange={(v) => v && setPurpose(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
            배너 문구 만들기
          </Button>
        </div>

        <div>
          <h2 className="mb-4 text-base font-semibold">결과</h2>
          {error && (
            <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>
          )}
          <div
            className="flex aspect-square w-full flex-col justify-end rounded-xl p-8 shadow-sm"
            style={{ background: style.bg }}
          >
            {result ? (
              <>
                <p className="text-2xl font-bold" style={{ color: style.text }}>{result.headline}</p>
                <p className="mt-2 text-sm" style={{ color: style.sub }}>{result.subtext}</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold" style={{ color: style.text }}>{season} · {personalColor}</p>
                <p className="mt-2 text-sm" style={{ color: style.sub }}>
                  왼쪽에서 컨셉을 정하고 생성하면 실제 문구가 여기 채워집니다.
                </p>
              </>
            )}
          </div>

          {result && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map((h) => (
                  <Badge key={h} variant="secondary">#{h}</Badge>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={copyAll}>
                <Copy className="h-3.5 w-3.5" /> 문구 전체 복사
              </Button>
            </div>
          )}
        </div>
      </div>

      <DevNote
        guideExample="가이드 예시 ② · 텍스트 입력만"
        owner="R3 규범 · R5 혜리"
        engines={["OpenAI (실제 연동됨, 서버 .env의 OPENAI_API_KEY 사용)", "템플릿 레이아웃 (배너 이미지 합성은 R5 예정)"]}
        preserve=""
        change="배너 전체"
        steps={[
          "사용자가 시즌·퍼스널컬러·산출물 종류를 선택 (API 키 입력 없음)",
          "/api/banner-copy로 { provider: \"openai\", season, personalColor, purpose, domainContext } POST",
          "서버가 resolveApiKey()로 .env의 OPENAI_API_KEY를 사용해 프롬프트 조립 후 OpenAI 실제 호출",
          "headline/subtext/hashtags JSON 응답을 CSS 배너 미리보기에 렌더링",
        ]}
        codeHint={`// 실제 연동 완료 — /api/banner-copy/route.ts\n// TODO(R5): 지금은 CSS 미리보기뿐 — 다운로드 가능한 이미지로 합성하려면\n// 결과를 <canvas>에 그려 PNG로 export 하는 단계 추가`}
      />
    </div>
  );
}
