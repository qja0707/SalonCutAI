"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Loader2, Sparkles, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { UploadDropzone } from "@/components/upload-dropzone";
import { BeforeAfter } from "@/components/before-after";
import { ResultPlaceholder } from "@/components/result-placeholder";
import { DevNote } from "@/components/dev-note";
import { sampleAvatarFile } from "@/lib/sample-assets";
import { IS_PUBLIC_PREVIEW, PUBLIC_PREVIEW_NOTICE } from "@/lib/public-preview";

const BG_STYLES = ["화이트 스튜디오", "우드톤 인테리어", "그린 식물 배경"];
const TONES = ["차분하게", "발랄하게", "전문적으로", "친근하게"];

export default function FaceSwapPage() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [ratio, setRatio] = useState("1:1 (인스타 피드)");
  const [cleanBg, setCleanBg] = useState(false);
  const [bgStyle, setBgStyle] = useState(BG_STYLES[0]);

  const [copyMode, setCopyMode] = useState<"ai" | "manual">("ai");
  const [copyText, setCopyText] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [domainContext, setDomainContext] = useState("");

  const [useRealImage, setUseRealImage] = useState(false);
  const [hfApiKey, setHfApiKey] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const photoUrl = photo ? URL.createObjectURL(photo) : null;

  async function handleUseSample() {
    setPhoto(await sampleAvatarFile());
  }

  async function handleGenerate() {
    if (!photo) {
      toast.warning("먼저 시술 사진을 업로드하거나 예시 사진을 사용해주세요.");
      return;
    }
    setGenerating(true);
    setImageError(null);
    setResultImageUrl(null);

    if (useRealImage) {
      if (!hfApiKey) {
        setImageError("실제 이미지 생성을 켜셨으면 HuggingFace API 키가 필요합니다.");
      } else {
        try {
          const fd = new FormData();
          fd.append("apiKey", hfApiKey);
          fd.append("image", photo);
          fd.append("strength", "0.55");
          fd.append(
            "prompt",
            `a different person, natural, photorealistic${cleanBg ? `, background changed to ${bgStyle}` : ", same background"}`
          );
          const res = await fetch("/api/generate-image", { method: "POST", body: fd });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `요청 실패 (${res.status})`);
          }
          const blob = await res.blob();
          setResultImageUrl(URL.createObjectURL(blob));
        } catch (e) {
          setImageError(e instanceof Error ? e.message : "알 수 없는 오류");
        }
      }
    } else {
      await new Promise((r) => setTimeout(r, 400));
    }

    setGenerated(true);
    setGenerating(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">💇 얼굴 교체 홍보 이미지</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        시술 사진 속 얼굴만 가상 인물로 바꿔드려요. 배경·헤어·의상은 그대로라, 고객 동의를 받은 사진을
        더 안전하게 홍보에 쓸 수 있습니다. 촬영·활용 동의는 반드시 먼저 받아주세요.
      </p>

      {IS_PUBLIC_PREVIEW && (
        <Alert className="mt-4">
          <AlertDescription>{PUBLIC_PREVIEW_NOTICE}</AlertDescription>
        </Alert>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* 입력 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. 사진 업로드</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <UploadDropzone label="시술 사진" file={photo} onChange={setPhoto} />
              <Button variant="outline" size="sm" className="w-full" onClick={handleUseSample}>
                📷 예시 사진으로 체험하기 (미팅 시연용)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. 옵션</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2 block">출력 비율</Label>
                <RadioGroup value={ratio} onValueChange={setRatio} className="flex flex-wrap gap-4">
                  {["1:1 (인스타 피드)", "4:5 (인스타 세로)", "9:16 (스토리)"].map((r) => (
                    <div key={r} className="flex items-center gap-2">
                      <RadioGroupItem value={r} id={r} />
                      <Label htmlFor={r} className="font-normal">{r}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="clean-bg">배경도 함께 깔끔하게 정리하기</Label>
                  <p className="text-xs text-muted-foreground">끄면 원래 배경은 그대로 두고 얼굴만 바뀝니다.</p>
                </div>
                <Switch id="clean-bg" checked={cleanBg} onCheckedChange={setCleanBg} />
              </div>

              {cleanBg && (
                <Select value={bgStyle} onValueChange={(v) => v && setBgStyle(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BG_STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {/* 공개 미리보기에서는 키 입력과 실제 호출을 숨긴다. 평문 HTTP 구간 노출 방지. */}
              {!IS_PUBLIC_PREVIEW && (
                <>
                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="real-image">실제 이미지 생성 시도 (실험)</Label>
                      <p className="text-xs text-muted-foreground">
                        HuggingFace로 실제 호출합니다. 아직 얼굴 마스킹 전이라 사진 전체가 변환돼요.
                      </p>
                    </div>
                    <Switch id="real-image" checked={useRealImage} onCheckedChange={setUseRealImage} />
                  </div>
                  {useRealImage && (
                    <div>
                      <Label className="mb-2 block">HuggingFace API 키</Label>
                      <Input
                        type="password"
                        placeholder="hf_..."
                        value={hfApiKey}
                        onChange={(e) => setHfApiKey(e.target.value)}
                      />
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        이 브라우저 세션에서만 사용되고 서버에 저장되지 않습니다. 콜드스타트로 10~30초 걸릴 수 있어요.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. 카드에 들어갈 문구</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={copyMode} onValueChange={(v) => setCopyMode(v as "ai" | "manual")} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ai" id="mode-ai" />
                  <Label htmlFor="mode-ai" className="font-normal">AI가 생성</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manual" id="mode-manual" />
                  <Label htmlFor="mode-manual" className="font-normal">직접 입력</Label>
                </div>
              </RadioGroup>

              {copyMode === "manual" ? (
                <Textarea
                  placeholder="예: 가을 웜톤 브라운 펌 · 예약 문의 DM"
                  value={copyText}
                  onChange={(e) => setCopyText(e.target.value)}
                />
              ) : (
                <div className="space-y-4">
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

                  <Separator />

                  <Link
                    href={`/generate/caption?${new URLSearchParams({
                      context: domainContext,
                      tone,
                      label: "페이스 스왑",
                    }).toString()}`}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
                  >
                    인스타 캡션 도구에서 만들기 <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    위 내용을 그대로 가져가서 실제 LLM으로 카드 문구·캡션을 생성합니다.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            홍보 이미지 만들기
          </Button>
        </div>

        {/* 결과 */}
        <div>
          <h2 className="mb-4 text-base font-semibold">결과</h2>
          {!generated ? (
            <Card className="flex aspect-square items-center justify-center border-dashed">
              <p className="max-w-[220px] text-center text-sm text-muted-foreground">
                왼쪽에서 사진과 옵션을 채운 뒤 버튼을 누르면 결과가 여기 표시됩니다.
              </p>
            </Card>
          ) : (
            <div className="space-y-5">
              {imageError && (
                <Alert variant="destructive">
                  <AlertDescription>{imageError}</AlertDescription>
                </Alert>
              )}
              <BeforeAfter
                originalUrl={photoUrl}
                after={
                  resultImageUrl ? (
                    <div className="space-y-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resultImageUrl} alt="생성 결과" className="aspect-square w-full rounded-lg border border-primary/40 object-cover" />
                      <p className="text-center text-[11px] text-muted-foreground">
                        실제 모델 결과 · 마스킹 전이라 사진 전체가 변환됐습니다
                      </p>
                    </div>
                  ) : (
                    <ResultPlaceholder
                      title="얼굴 교체 홍보 이미지"
                      meta={[ratio, cleanBg ? `배경 정리 · ${bgStyle}` : "배경 유지"]}
                    />
                  )
                }
              />
              {resultImageUrl ? (
                <a href={resultImageUrl} download="face-swap-result.png">
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="h-3.5 w-3.5" /> 이미지 다운로드
                  </Button>
                </a>
              ) : (
                <Button variant="outline" size="sm" className="w-full" disabled>
                  <Download className="h-3.5 w-3.5" /> 이미지 다운로드 (모델 연동 후 활성화)
                </Button>
              )}

              {copyMode === "manual" && (
                <div>
                  <p className="mb-1.5 text-sm font-medium">카드에 들어갈 문구</p>
                  <Alert><AlertDescription>{copyText || "(입력된 문구 없음)"}</AlertDescription></Alert>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <DevNote
        guideExample="가이드 예시 ④ · 이미지 보존"
        owner="R2 수민 · R4 영한"
        engines={[
          "HuggingFace Inference API (실제 연동 — 마스킹 전 image-to-image)",
          "얼굴 검출 (MediaPipe, 미구현 — TODO)",
          "Stable Diffusion Inpainting (마스킹 완료 후 전환 예정)",
          "인스타 캡션은 /generate/caption 범용 도구로 분리됨 (context/tone/label 쿼리로 연결)",
        ]}
        preserve="배경 · 헤어 · 의상 · 포즈 전체 (배경 정리 옵션 끈 경우, 마스킹 붙기 전까진 전체 변환됨)"
        change="얼굴(신원)만 · 배경 정리 옵션 켠 경우 배경도 포함"
        steps={[
          "사용자가 시술 사진 업로드 + 출력 비율·배경 옵션 선택",
          "'실제 이미지 생성 시도'를 켜면 사진(FormData)과 프롬프트를 /api/generate-image로 전송",
          "서버가 HuggingFace InferenceClient.imageToImage()를 실제 호출 (마스킹 전이라 사진 전체가 변환됨)",
          "생성된 이미지를 그대로 화면에 표시 · 다운로드 가능",
          "카드 문구는 이 페이지에서 직접 생성하지 않고, '인스타 캡션 도구에서 만들기' 링크로 /generate/caption에 연결",
        ]}
        codeHint={`// 이미지: /api/generate-image/route.ts — HF InferenceClient.imageToImage() 실제 호출 중\n// TODO(R2/R4): 얼굴 마스크(MediaPipe) 붙이면 image_to_image -> inpainting 전용 호출로 교체\n\n// 캡션: /generate/caption 페이지에서 /api/caption 호출 (이 페이지에서는 링크로만 연결)`}
      />
    </div>
  );
}
