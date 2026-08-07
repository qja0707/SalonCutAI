"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DevNote } from "@/components/dev-note";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { UploadDropzone } from "@/components/upload-dropzone";
import { copyBlogResult } from "@/lib/api-client/blog-content";
import { createJob, deleteJob, getJob, retryJob } from "@/lib/api-client/client";
import { RATIOS, type CreateJobPayload, type JobResponse, type MockScenario } from "@/lib/api-client/types";
import { IS_PUBLIC_PREVIEW, PUBLIC_PREVIEW_NOTICE } from "@/lib/public-preview";
import { sampleAvatarFile } from "@/lib/sample-assets";

const BG_STYLES = ["화이트 스튜디오", "우드톤 인테리어", "그린 식물 배경"];
const TONES = ["차분하게", "발랄하게", "전문적으로", "친근하게"];
const TERMINAL = new Set(["completed", "partial", "failed"]);
const EXPECTED_SECONDS = 16;

function progressMessage(job: JobResponse | null, elapsedSeconds: number): string {
  if (job?.image.status === "queued" && job.image.queue_position) {
    return `대기 순번 ${job.image.queue_position}번 · 사진을 확인하고 있어요`;
  }
  if (elapsedSeconds < 5) return "사진을 확인하고 있어요";
  if (elapsedSeconds <= EXPECTED_SECONDS) return `얼굴을 바꾸고 있어요 · ${elapsedSeconds}초`;
  return "평소보다 오래 걸리고 있어요";
}

export default function FaceSwapPage() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [cleanBg, setCleanBg] = useState(false);
  const [bgStyle, setBgStyle] = useState(BG_STYLES[0]);
  const [copyMode, setCopyMode] = useState<"ai" | "manual">("ai");
  const [copyText, setCopyText] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [domainContext, setDomainContext] = useState("");
  const [scenario, setScenario] = useState<MockScenario>("normal");

  const [requesting, setRequesting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const jobStatus = job?.status;
  const active = Boolean(jobId && (!jobStatus || !TERMINAL.has(jobStatus)));
  const resultImages = useMemo(() => (job?.image.status === "completed" ? job.image.results : null), [job]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  useEffect(() => {
    if (!active || startedAt === null) return;
    const update = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);

  useEffect(() => {
    if (!jobId || (jobStatus && TERMINAL.has(jobStatus))) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await getJob(jobId);
        if (!cancelled) setJob(next);
      } catch (error) {
        if (!cancelled) setRequestError(error instanceof Error ? error.message : "작업 상태를 불러오지 못했습니다.");
      }
    };
    void poll();
    const timer = window.setInterval(poll, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobId, jobStatus]);

  function handlePhotoChange(nextPhoto: File | null) {
    setPhoto(nextPhoto);
    setPhotoUrl(nextPhoto ? URL.createObjectURL(nextPhoto) : null);
  }

  async function handleUseSample() {
    handlePhotoChange(await sampleAvatarFile());
  }

  function buildPayload(): CreateJobPayload {
    return {
      // TODO(CONSENT-UI): 다음 작업에서 실제 동의 화면의 값을 연결한다.
      consent: { agreed: true, consent_version: "2026-08-06" },
      blog_input: {
        hair_length: "중단발",
        hair_texture: "반곱슬",
        hair_thickness: "얇은모발",
        damage_level: "손상모",
        customer_pain_point: copyMode === "manual" && copyText ? copyText : "아침 손질이 어렵고 모발 끝이 쉽게 갈라짐",
        base_cut: "레이어드컷",
        main_treatment: cleanBg ? `${bgStyle} 홍보 이미지` : "얼굴 교체 홍보 이미지",
        design_point: tone,
        region_keyword: domainContext || "성수동 미용실",
        designer_name: "담당 디자이너",
        duration_minutes: 90,
        special_product: "맞춤 홈케어",
      },
      options: { ratios: [...RATIOS], seed: null },
    };
  }

  async function handleGenerate() {
    if (!photo) {
      toast.warning("먼저 시술 사진을 업로드하거나 예시 사진을 사용해주세요.");
      return;
    }
    setRequesting(true);
    setRequestError(null);
    setJob(null);
    setJobId(null);
    setElapsedSeconds(0);
    const started = Date.now();
    setStartedAt(started);
    try {
      const created = await createJob(photo, buildPayload(), scenario);
      setJobId(created.job_id);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "작업을 시작하지 못했습니다.");
      setStartedAt(null);
    } finally {
      setRequesting(false);
    }
  }

  async function handleRetry(component: "image" | "blog") {
    if (!jobId) return;
    try {
      await retryJob(jobId, [component]);
      setJob(await getJob(jobId));
      setStartedAt(Date.now());
      setElapsedSeconds(0);
      toast.success("실패한 결과만 다시 만들고 있어요.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "다시 시도하지 못했습니다.");
    }
  }

  async function handleCopyBlog() {
    if (!job?.blog.result) return;
    try {
      await copyBlogResult(job.blog.result);
      toast.success("서식과 일반 텍스트를 함께 복사했어요.");
    } catch {
      toast.error("클립보드에 복사하지 못했습니다.");
    }
  }

  async function handleDelete() {
    if (!jobId) return;
    try {
      await deleteJob(jobId);
      setJobId(null);
      setJob(null);
      setStartedAt(null);
      setElapsedSeconds(0);
      toast.success("원본과 생성 결과를 삭제했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "결과를 삭제하지 못했습니다.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">💇 얼굴 교체 홍보 콘텐츠</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        고객의 헤어·의상·배경은 유지하고 얼굴만 가상 인물로 바꾼 뒤, 세 가지 홍보 이미지와 블로그 초안을 함께 만듭니다.
        촬영·활용 동의는 반드시 먼저 받아주세요.
      </p>

      {IS_PUBLIC_PREVIEW && <Alert className="mt-4"><AlertDescription>{PUBLIC_PREVIEW_NOTICE}</AlertDescription></Alert>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">1. 시술 사진</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <UploadDropzone label="시술 사진" file={photo} onChange={handlePhotoChange} />
              <Button variant="outline" size="sm" className="w-full" onClick={handleUseSample}>📷 예시 사진으로 체험하기</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">2. 홍보 옵션</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2 block">출력 비율</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">1:1 인스타 피드</Badge>
                  <Badge variant="secondary">4:5 인스타 세로</Badge>
                  <Badge variant="secondary">9:16 스토리 · fit_pad</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">한 번 생성한 결과를 세 규격으로 후처리합니다.</p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="clean-bg">배경도 함께 정리하기</Label>
                  <p className="text-xs text-muted-foreground">끄면 얼굴만 바꾸고 원래 배경을 유지합니다.</p>
                </div>
                <Switch id="clean-bg" checked={cleanBg} onCheckedChange={setCleanBg} />
              </div>
              {cleanBg && (
                <Select value={bgStyle} onValueChange={(value) => value && setBgStyle(value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{BG_STYLES.map((style) => <SelectItem key={style} value={style}>{style}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">3. 블로그 방향</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={copyMode} onValueChange={(value) => setCopyMode(value as "ai" | "manual")} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="ai" id="mode-ai" /><Label htmlFor="mode-ai" className="font-normal">AI 기본 초안</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="manual" id="mode-manual" /><Label htmlFor="mode-manual" className="font-normal">고민 직접 입력</Label></div>
              </RadioGroup>
              {copyMode === "manual" && <Textarea placeholder="예: 잦은 탈색으로 모발 끝이 갈라지고 손질이 어려워요" value={copyText} onChange={(event) => setCopyText(event.target.value)} />}
              <div>
                <Label className="mb-2 block">톤 앤 매너</Label>
                <Select value={tone} onValueChange={(value) => value && setTone(value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{TONES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">샵·지역 키워드 (선택)</Label>
                <Textarea placeholder="예: 성수동 20대 여성 고객, 미니멀 감성 살롱" value={domainContext} onChange={(event) => setDomainContext(event.target.value)} />
              </div>
            </CardContent>
          </Card>

          {!IS_PUBLIC_PREVIEW && (
            <Card>
              <CardHeader><CardTitle className="text-base">개발용 mock 시나리오</CardTitle></CardHeader>
              <CardContent>
                <Select value={scenario} onValueChange={(value) => value && setScenario(value as MockScenario)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">정상</SelectItem>
                    <SelectItem value="blog-fail">블로그 실패</SelectItem>
                    <SelectItem value="image-fail">이미지 실패</SelectItem>
                    <SelectItem value="both-fail">둘 다 실패</SelectItem>
                    <SelectItem value="slow">느린 처리</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Button className="w-full" size="lg" onClick={handleGenerate} disabled={requesting || active}>
            {requesting || active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {active ? progressMessage(job, elapsedSeconds) : "홍보 콘텐츠 만들기"}
          </Button>
        </div>

        <div className="space-y-5">
          <h2 className="text-base font-semibold">결과</h2>
          {requestError && <Alert variant="destructive"><AlertDescription>{requestError}</AlertDescription></Alert>}

          {!jobId ? (
            <Card className="flex aspect-square items-center justify-center border-dashed">
              <p className="max-w-[260px] text-center text-sm text-muted-foreground">사진과 옵션을 채운 뒤 버튼을 누르면 이미지와 블로그 결과가 순서대로 표시됩니다.</p>
            </Card>
          ) : (
            <>
              {active && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>{progressMessage(job, elapsedSeconds)}</AlertDescription>
                </Alert>
              )}

              {photoUrl && (
                <Card>
                  <CardHeader><CardTitle className="text-base">원본</CardTitle></CardHeader>
                  <CardContent>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl} alt="업로드한 원본" className="max-h-72 w-full rounded-lg object-contain" />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">홍보 이미지</CardTitle>
                  <Badge variant="secondary">시도 {job?.image.attempt ?? 1}회</Badge>
                </CardHeader>
                <CardContent>
                  {resultImages ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      {RATIOS.map((ratio) => {
                        const result = resultImages[ratio];
                        return (
                          <div key={ratio} className="space-y-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={result.url} alt={`${ratio} 홍보 이미지`} className="h-56 w-full rounded-lg border bg-muted object-contain" />
                            <div className="flex items-center justify-between text-xs"><span>{ratio}</span><Badge variant="outline">{result.format_mode}</Badge></div>
                            <a href={result.url} download><Button variant="outline" size="sm" className="w-full"><Download className="h-3.5 w-3.5" />다운로드</Button></a>
                          </div>
                        );
                      })}
                    </div>
                  ) : job?.image.status === "failed" ? (
                    <div className="space-y-3">
                      <Alert variant="destructive"><AlertDescription>{job.image.error?.message}</AlertDescription></Alert>
                      {job.image.error?.retryable && <Button variant="outline" onClick={() => handleRetry("image")}><RotateCcw className="h-4 w-4" />이미지만 다시 만들기</Button>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">이미지를 만들고 있습니다. 블로그가 먼저 완료되면 아래에서 바로 확인할 수 있어요.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">블로그 초안</CardTitle>
                  <Badge variant="secondary">시도 {job?.blog.attempt ?? 1}회</Badge>
                </CardHeader>
                <CardContent>
                  {job?.blog.result ? (
                    <div className="space-y-4">
                      <div><p className="text-lg font-semibold">{job.blog.result.title}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{job.blog.result.body}</p></div>
                      <div className="flex flex-wrap gap-1.5">{job.blog.result.hashtags.map((tag) => <Badge key={tag} variant="secondary">#{tag.replace(/^#+/, "")}</Badge>)}</div>
                      <Button variant="outline" size="sm" className="w-full" onClick={handleCopyBlog}><Copy className="h-3.5 w-3.5" />서식 포함 전체 복사</Button>
                    </div>
                  ) : job?.blog.status === "failed" ? (
                    <div className="space-y-3">
                      <Alert variant="destructive"><AlertDescription>{job.blog.error?.message}</AlertDescription></Alert>
                      {job.blog.error?.retryable && <Button variant="outline" onClick={() => handleRetry("blog")}><RotateCcw className="h-4 w-4" />블로그만 다시 만들기</Button>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">블로그 초안을 만들고 있습니다.</p>
                  )}
                </CardContent>
              </Card>

              {job && TERMINAL.has(job.status) && (
                <Button variant="outline" size="sm" className="w-full" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" />원본과 생성 결과 삭제</Button>
              )}
            </>
          )}
        </div>
      </div>

      <DevNote
        guideExample="MOCK-001 · 작업 A 종단 흐름"
        owner="서비스·UI · 서빙·인프라 담당"
        engines={["Next.js Route Handler mock", "MediaPipe + SDXL 인페인팅(후속 VM 프록시 연결)", "블로그 생성 모듈(후속 VM 프록시 연결)"]}
        preserve="헤어 · 의상 · 배경 · 포즈"
        change="얼굴(신원)만"
        steps={["사진과 생성 정보를 multipart로 /api/v1/jobs에 전송", "2초마다 작업 상태 확인", "완료되는 이미지·블로그 결과부터 화면에 표시", "실패한 컴포넌트만 재시도", "완료 뒤 원본과 결과 삭제 가능"]}
        codeHint={`// 브라우저는 SALON_API_MODE를 알지 못하고 /api/v1/**만 호출\n// 서버 기본값 mock, 인증·HTTPS 준비 후 proxy 구현\n// 진행 시간은 안내 문구에만 사용하고 실패는 서버 상태로 판정`}
      />
    </div>
  );
}
