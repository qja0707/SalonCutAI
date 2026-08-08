"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Download, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DevNote } from "@/components/dev-note";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UploadDropzone } from "@/components/upload-dropzone";
import {
  createFaceSwapJob,
  deleteFaceSwapJob,
  getFaceSwapJob,
  retryFaceSwapJob,
} from "@/lib/api-client/client";
import {
  RATIOS,
  type CreateFaceSwapJobPayload,
  type FaceSwapJobResponse,
  type MockScenario,
} from "@/lib/api-client/types";
import { IS_PUBLIC_PREVIEW, PUBLIC_PREVIEW_NOTICE } from "@/lib/public-preview";
import { sampleAvatarFile } from "@/lib/sample-assets";
import { CONSENT_CONTENT, CONSENT_VERSION } from "@/lib/consent";

const BG_STYLES = ["화이트 스튜디오", "우드톤 인테리어", "그린 식물 배경"];
const TERMINAL = new Set(["completed", "failed"]);
const EXPECTED_SECONDS = 16;

function progressMessage(job: FaceSwapJobResponse | null, elapsedSeconds: number): string {
  if (job?.status === "queued" && job.queue_position) {
    return `대기 순번 ${job.queue_position}번 · 사진을 확인하고 있어요`;
  }
  if (elapsedSeconds < 5) return "사진을 확인하고 있어요";
  if (elapsedSeconds <= EXPECTED_SECONDS) return `얼굴을 바꾸고 있어요 · ${elapsedSeconds}초`;
  return "평소보다 오래 걸리고 있어요";
}

export default function FaceSwapPage() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [cleanBg, setCleanBg] = useState(false);
  const [bgStyle, setBgStyle] = useState(BG_STYLES[0]);
  const [scenario, setScenario] = useState<MockScenario>("normal");
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const [requesting, setRequesting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<FaceSwapJobResponse | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const jobStatus = job?.status;
  const active = Boolean(jobId && (!jobStatus || !TERMINAL.has(jobStatus)));
  const resultImages = useMemo(() => (job?.status === "completed" ? job.results : null), [job]);

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
        const next = await getFaceSwapJob(jobId);
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
    setConsentAgreed(false);
  }

  async function handleUseSample() {
    handlePhotoChange(await sampleAvatarFile());
  }

  function buildPayload(): CreateFaceSwapJobPayload {
    return {
      consent: { agreed: consentAgreed, consent_version: CONSENT_VERSION },
      options: {
        ratios: [...RATIOS],
        seed: null,
        background_mode: cleanBg ? "replace" : "preserve",
        background_style: cleanBg ? bgStyle : null,
      },
    };
  }

  async function handleGenerate() {
    if (!photo) {
      toast.warning("먼저 시술 사진을 업로드하거나 예시 사진을 사용해주세요.");
      return;
    }
    if (!consentAgreed) {
      toast.warning("고객의 사진 활용 동의를 받은 뒤 확인해주세요.");
      return;
    }
    setRequesting(true);
    setRequestError(null);
    setJob(null);
    setJobId(null);
    setElapsedSeconds(0);
    setStartedAt(Date.now());
    try {
      const created = await createFaceSwapJob(photo, buildPayload(), scenario);
      setJobId(created.job_id);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "작업을 시작하지 못했습니다.");
      setStartedAt(null);
    } finally {
      setRequesting(false);
    }
  }

  async function handleRetry() {
    if (!jobId) return;
    try {
      await retryFaceSwapJob(jobId);
      setJob(await getFaceSwapJob(jobId));
      setStartedAt(Date.now());
      setElapsedSeconds(0);
      toast.success("얼굴 교체 이미지를 다시 만들고 있어요.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "다시 시도하지 못했습니다.");
    }
  }

  async function handleDelete() {
    if (!jobId) return;
    try {
      await deleteFaceSwapJob(jobId);
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
      <h1 className="text-2xl font-semibold tracking-tight">💇 얼굴 교체 홍보 이미지</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        고객의 헤어·의상·배경은 유지하고 얼굴만 가상 인물로 바꾼 뒤 세 가지 홍보 이미지 규격을 만듭니다.
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
            <CardHeader><CardTitle className="text-base">2. {CONSENT_CONTENT.title}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{CONSENT_CONTENT.introduction}</p>
              <Collapsible open={consentOpen} onOpenChange={setConsentOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm font-medium hover:bg-muted/60">
                  동의 내용 전체 보기
                  <ChevronDown className={`h-4 w-4 transition-transform ${consentOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <ul className="space-y-2 rounded-md bg-muted/40 p-4 text-sm text-muted-foreground">
                    {CONSENT_CONTENT.details.map((detail) => <li key={detail}>· {detail}</li>)}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
              <div className="flex items-start gap-3 rounded-md border p-4">
                <input
                  id="consent-agreed"
                  type="checkbox"
                  checked={consentAgreed}
                  onChange={(event) => setConsentAgreed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <Label htmlFor="consent-agreed" className="cursor-pointer leading-5">
                  {CONSENT_CONTENT.confirmation}
                </Label>
              </div>
              {!consentAgreed && (
                <p id="consent-required" role="status" className="text-sm text-amber-700 dark:text-amber-400">
                  고객의 사진 활용 동의를 확인해야 이미지를 만들 수 있습니다.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">3. 홍보 이미지 옵션</CardTitle></CardHeader>
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

          {!IS_PUBLIC_PREVIEW && (
            <Card>
              <CardHeader><CardTitle className="text-base">개발용 mock 시나리오</CardTitle></CardHeader>
              <CardContent>
                <Select value={scenario} onValueChange={(value) => value && setScenario(value as MockScenario)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">정상</SelectItem>
                    <SelectItem value="image-fail">생성 실패 · 재시도 가능</SelectItem>
                    <SelectItem value="face-not-detected">얼굴 미검출 · 재시도 불가</SelectItem>
                    <SelectItem value="slow">느린 처리</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={requesting || active || !consentAgreed}
            aria-describedby={!consentAgreed ? "consent-required" : undefined}
          >
            {requesting || active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {active ? progressMessage(job, elapsedSeconds) : "얼굴 교체 이미지 만들기"}
          </Button>
        </div>

        <div className="space-y-5">
          <h2 className="text-base font-semibold">결과</h2>
          {requestError && <Alert variant="destructive"><AlertDescription>{requestError}</AlertDescription></Alert>}

          {!jobId ? (
            <Card className="flex aspect-square items-center justify-center border-dashed">
              <p className="max-w-[260px] text-center text-sm text-muted-foreground">사진과 옵션을 채운 뒤 버튼을 누르면 얼굴 교체 이미지 결과가 표시됩니다.</p>
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
                  <Badge variant="secondary">시도 {job?.attempt ?? 1}회</Badge>
                </CardHeader>
                <CardContent>
                  {job?.consent_recorded_at && (
                    <p className="mb-4 text-xs text-muted-foreground">
                      동의 확인 기록: {new Date(job.consent_recorded_at).toLocaleString("ko-KR")}
                    </p>
                  )}
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
                  ) : job?.status === "failed" ? (
                    <div className="space-y-3">
                      <Alert variant="destructive"><AlertDescription>{job.error?.message}</AlertDescription></Alert>
                      {job.error?.retryable && <Button variant="outline" onClick={handleRetry}><RotateCcw className="h-4 w-4" />다시 만들기</Button>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">얼굴 교체 이미지를 만들고 있습니다.</p>
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
        guideExample="MOCK-001 · 얼굴 교체 job 종단 흐름"
        owner="이미지 생성 · 서비스·UI · 서빙·인프라 담당"
        engines={["Next.js Route Handler mock", "MediaPipe + SDXL 인페인팅(후속 VM 프록시 연결)"]}
        preserve="헤어 · 의상 · 배경 · 포즈"
        change="얼굴(신원)만"
        steps={["사진과 옵션을 multipart로 /api/v1/face-swap-jobs에 전송", "2초마다 얼굴 교체 job 상태 확인", "완료된 3규격 이미지 표시", "재시도 가능한 job 전체 재시도", "완료 뒤 원본과 결과 삭제 가능"]}
        codeHint={`// 얼굴 교체·블로그·영상은 각각 독립 job
// 서버 기본값 mock, 인증·HTTPS 준비 후 proxy 구현
// 진행 시간은 안내 문구에만 사용하고 실패는 서버 상태로 판정`}
      />
    </div>
  );
}
