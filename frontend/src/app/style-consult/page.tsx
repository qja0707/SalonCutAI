"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, ChevronRight, Loader2, Sparkles, Download, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChipGroup } from "@/components/chip-group";
import { UploadDropzone } from "@/components/upload-dropzone";
import { BeforeAfter } from "@/components/before-after";
import { ResultPlaceholder } from "@/components/result-placeholder";
import { PersonaForm } from "@/components/persona-form";
import { DevNote } from "@/components/dev-note";
import { cn } from "@/lib/utils";
import { sampleAvatarFile } from "@/lib/sample-assets";
import {
  GENDERS,
  CUT_LENGTHS,
  TEXTURES,
  COLORS,
  SERVICES,
  AESTHETIC_VIBES,
  EMPTY_PERSONA,
  type PersonaAnswers,
} from "@/lib/style-taxonomy";
import { buildStylePrompt } from "@/lib/style-prompt";

type StyleRecommendation = {
  recommendation: string;
  reasons: string;
  cautions: string;
  imagePrompt: string;
};

export default function StyleConsultPage() {
  const [photo, setPhoto] = useState<File | null>(null);

  const [services, setServices] = useState<string[]>([SERVICES[0]]);
  const [styleMode, setStyleMode] = useState<"template" | "reference">("template");
  const [gender, setGender] = useState<string[]>([GENDERS[0]]);
  const [cutLength, setCutLength] = useState<string[]>([CUT_LENGTHS[2]]);
  const [texture, setTexture] = useState<string[]>([TEXTURES[0]]);
  const [color, setColor] = useState<string[]>([COLORS[0]]);
  const [colorOther, setColorOther] = useState("");
  const [aestheticVibes, setAestheticVibes] = useState<string[]>([]);
  const [reference, setReference] = useState<File | null>(null);

  const [personaOpen, setPersonaOpen] = useState(false);
  const [persona, setPersona] = useState<PersonaAnswers>(EMPTY_PERSONA);

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [aiResult, setAiResult] = useState<StyleRecommendation | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const photoUrl = photo ? URL.createObjectURL(photo) : null;
  const colorLabel = color[0] === "기타" && colorOther ? colorOther : color[0];

  async function handleGenerate() {
    if (!photo) {
      toast.warning("먼저 고객 얼굴 사진을 업로드하거나 예시 사진을 사용해주세요.");
      return;
    }
    if (styleMode === "reference" && !reference) {
      toast.warning("레퍼런스 이미지를 업로드해주세요.");
      return;
    }
    setGenerating(true);
    setAiError(null);
    setAiResult(null);

    // TODO(R2/R4): ControlNet(얼굴 고정) + IP-Adapter(스타일 반영) 호출 — 아래 AI 추천의
    // imagePrompt를 이미지 생성 모델 프롬프트로 그대로 사용하면 됨
    await new Promise((r) => setTimeout(r, 500));

    try {
      const res = await fetch("/api/style-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          services,
          gender: gender[0] ?? "",
          cutLength: cutLength[0] ?? "",
          texture: texture[0] ?? "",
          color: colorLabel,
          aestheticVibes,
          persona,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청 실패");
      setAiResult(data);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "알 수 없는 오류");
    }

    setGenerated(true);
    setGenerating(false);
  }

  const styleLabel =
    styleMode === "template"
      ? [gender[0], cutLength[0], texture[0], colorLabel].filter(Boolean).join(" · ")
      : "레퍼런스 이미지 스타일";

  const compiledPrompt = aiResult
    ? buildStylePrompt({
        services,
        gender: gender[0] ?? "",
        cutLength: cutLength[0] ?? "",
        texture: texture[0] ?? "",
        color: colorLabel,
        aestheticVibes,
        persona,
      })
    : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">🎨 퍼스널 스타일 상담</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        고객 얼굴은 그대로 두고, 원하는 헤어스타일만 미리 씌워서 보여드려요. 시술 전 상담에서
        &ldquo;저한테 이 스타일 어울릴까요?&rdquo;에 바로 답할 수 있습니다.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">1. 고객 얼굴 사진</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <UploadDropzone label="고객 얼굴 사진" file={photo} onChange={setPhoto} />
              <Button variant="outline" size="sm" className="w-full" onClick={async () => setPhoto(await sampleAvatarFile())}>
                📷 예시 사진으로 체험하기 (미팅 시연용)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">2. 시술·스타일 선택</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2 block">받고 싶은 시술 (복수 선택 가능)</Label>
                <ChipGroup options={SERVICES} value={services} onChange={setServices} />
              </div>

              <RadioGroup value={styleMode} onValueChange={(v) => setStyleMode(v as "template" | "reference")} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="template" id="m-template" />
                  <Label htmlFor="m-template" className="font-normal">카테고리에서 고르기</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="reference" id="m-reference" />
                  <Label htmlFor="m-reference" className="font-normal">레퍼런스 사진으로</Label>
                </div>
              </RadioGroup>

              {styleMode === "template" ? (
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">성별</Label>
                    <ChipGroup options={GENDERS} value={gender} onChange={setGender} multiple={false} />
                  </div>
                  <div>
                    <Label className="mb-2 block">커트 길이</Label>
                    <ChipGroup options={CUT_LENGTHS} value={cutLength} onChange={setCutLength} multiple={false} />
                  </div>
                  <div>
                    <Label className="mb-2 block">텍스처</Label>
                    <ChipGroup options={TEXTURES} value={texture} onChange={setTexture} multiple={false} />
                  </div>
                  <div>
                    <Label className="mb-2 block">컬러</Label>
                    <ChipGroup options={COLORS} value={color} onChange={setColor} multiple={false} />
                    {color[0] === "기타" && (
                      <Input
                        className="mt-2"
                        placeholder="원하는 컬러를 직접 입력해주세요"
                        value={colorOther}
                        onChange={(e) => setColorOther(e.target.value)}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <UploadDropzone label="원하는 스타일이 담긴 레퍼런스 이미지" file={reference} onChange={setReference} />
              )}

              <div>
                <Label className="mb-2 block">추구미 (원하는 전체적인 분위기, 복수 선택 가능)</Label>
                <ChipGroup options={AESTHETIC_VIBES} value={aestheticVibes} onChange={setAestheticVibes} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <Collapsible open={personaOpen} onOpenChange={setPersonaOpen}>
              <CardHeader>
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">3. 페르소나 설정 (상담 카드)</CardTitle>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", personaOpen && "rotate-90")} />
                </CollapsibleTrigger>
                <p className="mt-1 text-xs text-muted-foreground">
                  실제 매장 상담 카드(3~15번 문항) 기준 정보예요. 답변이 구체적일수록 아래 AI 추천의 근거가
                  정교해집니다. (선택 입력)
                </p>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <PersonaForm value={persona} onChange={setPersona} />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <p className="text-xs text-muted-foreground">
            위 정보를 근거로 AI가 어울리는 스타일과 이유·주의사항을 자동으로 정리해드려요.
          </p>

          <Button className="w-full" size="lg" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            스타일 시안 만들기
          </Button>
        </div>

        <div>
          <h2 className="mb-4 text-base font-semibold">결과</h2>
          {!generated ? (
            <Card className="flex aspect-square items-center justify-center border-dashed">
              <p className="max-w-[220px] text-center text-sm text-muted-foreground">
                왼쪽에서 사진과 스타일을 선택한 뒤 버튼을 누르면 결과가 여기 표시됩니다.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <BeforeAfter
                originalUrl={photoUrl}
                after={<ResultPlaceholder title="스타일 추천 시안" meta={[styleLabel, ...services, ...aestheticVibes].filter(Boolean)} />}
              />
              <Button variant="outline" size="sm" className="w-full" disabled>
                <Download className="h-3.5 w-3.5" /> 이미지 다운로드 (모델 연동 후 활성화)
              </Button>
              <Alert>
                <AlertDescription>
                  이 시안은 아직 하지 않은 스타일을 미리 보여주는 상담용입니다. 실제 시술 결과와 다를 수 있어요.
                </AlertDescription>
              </Alert>

              {aiError && (
                <Alert variant="destructive"><AlertDescription>{aiError}</AlertDescription></Alert>
              )}
              {aiResult && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">AI 추천 스타일</p>
                    <p className="text-sm">{aiResult.recommendation}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">추천 이유</p>
                    <p className="text-sm text-muted-foreground">{aiResult.reasons}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">주의사항</p>
                    <p className="text-sm text-muted-foreground">{aiResult.cautions}</p>
                  </div>
                  <Link
                    href={`/generate/image?${new URLSearchParams({ prompt: aiResult.imagePrompt, label: "퍼스널 스타일 상담" }).toString()}`}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
                  >
                    이 스타일로 실제 이미지 생성하러 가기 <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <DevNote
        guideExample="가이드 예시 ③ · 레퍼런스 사용"
        owner="R2 수민 · R4 영한 · R3 규범(추천 프롬프트)"
        engines={[
          "OpenAI (스타일 추천 — 실제 연동됨, /api/style-recommendation, 서버 .env의 OPENAI_API_KEY 사용)",
          "ControlNet · IP-Adapter · Diffusers (이미지 시안 생성, 미구현 — TODO)",
        ]}
        preserve="얼굴"
        change="헤어스타일"
        steps={[
          "사용자가 시술·카테고리(성별/길이/텍스처/컬러)·추구미·페르소나(상담 카드)를 선택/입력 — 프롬프트는 전혀 입력하지 않음",
          "/api/style-recommendation으로 위 값들을 그대로 POST",
          "서버의 buildStylePrompt()가 이 값들을 하나의 프롬프트로 자동 조합 (src/lib/style-prompt.ts) — 유저에게는 안 보임",
          "OpenAI를 JSON 모드로 실제 호출",
          "recommendation/reasons/cautions만 유저 화면에 표시. imagePrompt는 화면에 노출하지 않고 '이미지 생성하러 가기' 버튼에만 담아 전달",
          "(TODO) 실제 얼굴 유지 이미지 시안은 ControlNet+IP-Adapter 연동 후 이 imagePrompt를 그대로 사용",
        ]}
        codeHint={`// /api/style-recommendation/route.ts — buildStylePrompt()가 카테고리·추구미·\n// 페르소나(실제 매장 상담 카드 3~15번 문항 기반) 답변을 하나의 프롬프트로 조합해\n// OpenAI/Gemini에 실제로 전달함 (src/lib/style-prompt.ts)\n\n// TODO(R2/R4): 위 응답의 imagePrompt를 ControlNet+IP-Adapter 이미지 생성 호출에 그대로 사용`}
        livePrompt={compiledPrompt}
      />
    </div>
  );
}
