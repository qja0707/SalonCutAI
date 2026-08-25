"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResultPlaceholder } from "@/components/result-placeholder";
import { DevNote } from "@/components/dev-note";
import { IS_PUBLIC_PREVIEW, PUBLIC_PREVIEW_NOTICE } from "@/lib/public-preview";
import { PageShell } from "@/components/flow/page-shell";

export function ImageGenerator() {
  const searchParams = useSearchParams();
  const label = searchParams.get("label");
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const [apiKey, setApiKey] = useState("");
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!apiKey) {
      toast.warning("HuggingFace API 키를 입력해주세요.");
      return;
    }
    if (!prompt) {
      toast.warning("이미지 프롬프트를 입력해주세요.");
      return;
    }
    setGenerating(true);
    setError(null);
    setImageUrl(null);
    try {
      const res = await fetch("/api/text-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, prompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `요청 실패 (${res.status})`);
      }
      const blob = await res.blob();
      setImageUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    }
    setGenerating(false);
  }

  return (
    <PageShell
      width="5xl"
      title="🖼️ AI 이미지 생성"
      description={
        <>
          프롬프트 한 줄로 홍보 이미지를 만드는 범용 도구예요. 마케팅 캘린더·스타일 상담 등 다른 기능에서
          만든 프롬프트를 그대로 가져와 이어서 생성할 수도 있어요.
        </>
      }
      badge={label && <Badge variant="secondary">연결된 컨텍스트 · {label}</Badge>}
    >
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">1. 프롬프트</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">이미지 프롬프트 (영문 권장)</Label>
                <Textarea
                  rows={6}
                  placeholder="예: bright modern hair salon interior, warm lighting, glossy healthy hair close-up, photorealistic"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              {/* 공개 미리보기에서는 키 입력을 숨긴다. 평문 HTTP 구간 노출 방지. */}
              {IS_PUBLIC_PREVIEW ? (
                <Alert>
                  <AlertDescription>{PUBLIC_PREVIEW_NOTICE}</AlertDescription>
                </Alert>
              ) : (
                <div>
                  <Label className="mb-2 block">HuggingFace API 키</Label>
                  <Input
                    type="password"
                    placeholder="hf_..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    이 브라우저 세션에서만 사용되고 서버에 저장되지 않습니다. 콜드스타트로 10~30초 걸릴 수 있어요.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleGenerate} disabled={generating || IS_PUBLIC_PREVIEW}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            이미지 생성하기
          </Button>
        </div>

        <div>
          <h2 className="mb-4 text-base font-semibold">결과</h2>
          {error && (
            <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>
          )}
          {imageUrl ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="생성된 이미지" className="aspect-square w-full rounded-lg border object-cover" />
              <a href={imageUrl} download="ai-image.png">
                <Button variant="outline" size="sm" className="w-full">
                  <Download className="h-3.5 w-3.5" /> 이미지 다운로드
                </Button>
              </a>
            </div>
          ) : (
            <ResultPlaceholder title={label ?? "AI 홍보 이미지"} meta={prompt ? [prompt.slice(0, 24) + (prompt.length > 24 ? "…" : "")] : []} />
          )}
        </div>
      </div>

      <DevNote
        guideExample="가이드 예시 ② · 텍스트 입력만"
        owner="R5 혜리"
        engines={["HuggingFace Inference API (실제 연동 — text-to-image)"]}
        preserve=""
        change="이미지 전체"
        steps={[
          "사용자가 프롬프트와 HuggingFace API 키를 입력",
          "/api/text-to-image로 { apiKey, prompt } POST",
          "서버가 InferenceClient.textToImage()를 실제 호출 (모델: stable-diffusion-xl-base-1.0, HF_IMAGE_MODEL로 교체 가능)",
          "생성된 이미지(Blob)를 그대로 응답으로 반환",
          "브라우저가 Blob URL로 변환해 화면에 표시 · 다운로드 가능",
        ]}
        codeHint={`// /api/text-to-image/route.ts — HF InferenceClient.textToImage() 실제 호출\n// 다른 페이지에서 /generate/image?prompt=...&label=... 로 링크하면 프롬프트가 자동 채워짐`}
      />
    </PageShell>
  );
}
