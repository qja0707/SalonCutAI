"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Download, Images, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FaceCheck } from "@/components/face-check";
import { BeforeAfterSlider } from "@/components/before-after";
import { FaceSwapWaiting } from "@/components/face-swap-waiting";
import {
  StepNav,
  StepProgress,
  scrollIntoViewOnNarrow,
  stepVisibility,
} from "@/components/flow/step-flow";
import { FaceSwapRecentStrip } from "@/components/face-swap-recent-strip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DevNote } from "@/components/dev-note";
import {
  EMPTY_FACE_VALUES,
  FaceOptionForm,
  buildFaceOption,
  isFaceReady,
  type FaceOptionValues,
} from "@/components/face-option-form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UploadDropzone } from "@/components/upload-dropzone";
import {
  createFaceSwapJob,
  deleteFaceSwapJob,
  getFaceSwapJob,
  isNotFoundError,
  retryFaceSwapJob,
} from "@/lib/api-client/client";
import { clearActiveJob, readActiveJob, writeActiveJob } from "@/lib/active-job";
import { addRecentJob, removeRecentJob } from "@/lib/recent-jobs";
import {
  RATIOS,
  type CreateFaceSwapJobPayload,
  type FaceSwapJobResponse,
  type MockScenario,
  type Ratio,
} from "@/lib/api-client/types";
import { SHOW_DEV_TOOLS } from "@/lib/public-preview";
import { sampleAvatarFile } from "@/lib/sample-assets";
import { CONSENT_CONTENT, CONSENT_VERSION } from "@/lib/consent";
import { errorMessage, jobErrorMessage } from "@/lib/api-client/error-message";
import { PageShell } from "@/components/flow/page-shell";

/**
 * 배경 교체는 기능 2로 넘어갔다(8/12 수민님 회신). 이번 MVP 백엔드는 preserve 만 지원한다.
 *
 * 토글을 남겨두면 켤 수 있는데, 켜면 `background_mode: "replace"` 로 나가고 서버 검증도
 * 통과한다 — 지원하지 않는 기능을 손님이 켜는 상태가 된다. 그래서 화면에서만 감춘다.
 * 지우지 않는 이유는 payload 규칙과 검증이 이미 짝을 맞춰 있어서, 기능 2에서
 * 이 플래그만 켜면 되기 때문이다. 배경 스타일 후보 9종은 #69 2-9 에 있다.
 */
const BACKGROUND_REPLACE_READY = false;

const BG_STYLES = ["화이트 스튜디오", "우드톤 인테리어", "그린 식물 배경"];

/**
 * 규격 옆에 쓰임새를 같이 적는다. 숫자만 보고 어디에 올릴 규격인지 아는 사람은 드물다.
 * 4:5 를 권장으로 표시하는 근거 — Meta 안내상 인스타 피드는 4:5까지 지원 범위라
 * 원본 비율이 유지된다. 그보다 긴 세로 컷만 잘리므로, 세로 사진은 4:5 가 안전하다.
 *
 * 권장·릴스 같은 수식은 이름에 섞지 않고 배지로 뗀다(8/17 원장님). 이름은 랜딩
 * 신뢰 줄과 같은 어휘를 쓴다: 피드 · 피드 세로 · 스토리.
 */
const RATIO_USAGE: Record<Ratio, { label: string; badge?: string }> = {
  "1:1": { label: "피드" },
  "4:5": { label: "피드 세로", badge: "권장" },
  "9:16": { label: "스토리", badge: "릴스" },
};
const TERMINAL = new Set(["completed", "failed"]);

/** 결과까지 포함한 단계 수. 진행 표시는 입력 4단계만 센다. */
const PHONE_STEPS = ["시술 사진", "사진 활용 동의", "AI 모델", "이미지 옵션"] as const;
const PHONE_INPUT_STEP_COUNT = 4;

/**
 * 목적지 색(Discussion #149 3번) — 결과물을 올릴 곳에서 색을 가져온다.
 * 얼굴 교체와 숏폼은 둘 다 인스타로 가서, 인스타 그라디언트의 양 끝을 나눠 쓴다 —
 * 얼굴 교체는 퍼플·마젠타 끝. 흰 글자 대비 6.59:1(버튼·진행바), 배지는
 * 옅은 wash 위에 ink 글자로 5.73:1 — 둘 다 WCAG AA(4.5:1) 통과.
 */
const IDENTITY_INK = "#A32D74";
const IDENTITY_WASH = "#fdeaf5";

export default function FaceSwapPage() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [face, setFace] = useState<FaceOptionValues>(EMPTY_FACE_VALUES);
  const [cleanBg, setCleanBg] = useState(false);
  const [bgStyle, setBgStyle] = useState(BG_STYLES[0]);
  const [scenario, setScenario] = useState<MockScenario>("normal");
  const [consentAgreed, setConsentAgreed] = useState(false);

  const [requesting, setRequesting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<FaceSwapJobResponse | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [downloadNoticeShown, setDownloadNoticeShown] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  // 지금 화면의 job 이 어느 사진으로 만들어졌는지. 복구된 job 은 원본이 없어 null 이고,
  // 결과가 뜬 뒤 사진을 갈아끼우면 photoUrl 과 어긋난다 — 어긋난 쌍은 비교 화면에 올리지
  // 않는다 (#105 리뷰 지적: 복구/교체된 사진이 남의 결과와 한 쌍처럼 보이던 문제).
  const [jobPhotoUrl, setJobPhotoUrl] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restored, setRestored] = useState(false);
  // 완료·삭제가 일어날 때 올려서 하단 스트립이 보관함을 다시 읽게 한다
  const [recentRefresh, setRecentRefresh] = useState(0);
  // 폰 단계식(A안)에서 지금 보여줄 단계. 1~4 는 입력, 5 는 결과.
  // lg 이상에서는 쓰이지 않는다 — 카드가 전부 렌더된다.
  const [phoneStep, setPhoneStep] = useState(1);
  const resultRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

  const jobStatus = job?.status;
  const active = Boolean(jobId && (!jobStatus || !TERMINAL.has(jobStatus)));
  const resultImages = useMemo(() => (job?.status === "completed" ? job.results : null), [job]);
  // 진행 중에는 사진·동의도 잠근다. 바꾸면 원본·결과 비교쌍이 어긋난다(감사 F2).
  const busy = requesting || active;

  // 새로고침 전에 만들던 job 을 이어받는다. 마운트 때 한 번만 돈다.
  //
  // setState 는 전부 이 안쪽 async 함수에 둔다. effect 본문에서 곧바로 부르면
  // 렌더가 한 번 더 도는 것을 react-hooks/set-state-in-effect 가 막는다.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = readActiveJob("face-swap");
      // 랜딩의 "예시 사진으로 체험하기"에서 넘어온 경우 — 빈 1단계에 떨어뜨리지
      // 않고 예시를 바로 싣는다. 복구할 job 이 있으면 그쪽이 우선이지만(이미 만들던
      // 사람에게 예시를 덮어씌우면 안 된다), 그 job 이 만료(404)로 정리된 경우에는
      // 예시 진입 의도를 살린다 — catch 에서도 불러야 해서 try 밖에 둔다.
      const loadSampleIfWanted = async () => {
        if (!new URLSearchParams(window.location.search).has("sample")) return;
        const sample = await sampleAvatarFile();
        if (!cancelled) handlePhotoChange(sample);
      };
      try {
        if (!saved) {
          await loadSampleIfWanted();
          return;
        }
        const savedJob = await getFaceSwapJob(saved.jobId);
        if (cancelled) return;
        setJob(savedJob);
        setJobId(saved.jobId);
        setPhoneStep(PHONE_INPUT_STEP_COUNT + 1);
        setStartedAt(saved.startedAt);
        setRestored(true);
        // 화면이 닫힌 사이에 완료됐다면 이 시점이 완료를 처음 보는 순간이다.
        if (savedJob.status === "completed") {
          addRecentJob(saved.jobId);
          setRecentRefresh((value) => value + 1);
        }
      } catch (error) {
        if (cancelled) return;
        // 서버에서 사라진 작업(404)이면 저장분을 버린다.
        // 통신이 안 되는 것뿐이면 남겨두고 다음 새로고침에 다시 시도한다.
        if (isNotFoundError(error)) {
          clearActiveJob("face-swap");
          // 만료된 job 을 정리한 경우에도 예시 진입 의도는 살린다 — 안 그러면
          // ?sample=1 로 왔는데 빈 1단계에 남는다(#121 리뷰).
          await loadSampleIfWanted();
        } else setRequestError(errorMessage(error, "이전 작업을 불러오지 못했습니다."));
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        if (cancelled) return;
        setJob(next);
        // 순간 통신 장애로 남은 오류는 다음 성공이 지운다. 안 지우면 결과가
        // 잘 나온 화면 위에 빨간 경고가 계속 떠 있다.
        setRequestError(null);
        // 완료를 본 순간 하단 스트립 보관함에 넣는다. 중복은 add 쪽이 거른다.
        if (next.status === "completed") {
          addRecentJob(jobId);
          setRecentRefresh((value) => value + 1);
        }
      } catch (error) {
        if (!cancelled) setRequestError(errorMessage(error, "작업 상태를 불러오지 못했습니다."));
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
        face: buildFaceOption(face),
      },
    };
  }

  async function handleGenerate() {
    if (!photo) {
      toast.warning("먼저 시술 사진을 업로드하거나 예시 사진을 사용해주세요.");
      return;
    }
    if (!consentAgreed) {
      toast.warning("고객에게 받은 사진 활용 동의를 확인해주세요.");
      return;
    }
    if (!isFaceReady(face)) {
      toast.warning(
        face.mode === "reference"
          ? "바꿀 AI 모델을 골라주세요."
          : "국적 · 성별 · 연령대를 골라주세요.",
      );
      return;
    }
    setRequesting(true);
    setRequestError(null);
    setJob(null);
    setJobId(null);
    setRestored(false);
    setElapsedSeconds(0);
    const startedAtMs = Date.now();
    setStartedAt(startedAtMs);
    try {
      const created = await createFaceSwapJob(photo, buildPayload(), scenario);
      setJobId(created.job_id);
      setPhoneStep(PHONE_INPUT_STEP_COUNT + 1);
      setJobPhotoUrl(photoUrl);
      scrollIntoViewOnNarrow(resultRef.current);
      writeActiveJob("face-swap", { jobId: created.job_id, startedAt: startedAtMs });
    } catch (error) {
      setRequestError(errorMessage(error, "작업을 시작하지 못했습니다."));
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
      // 재시도는 시계를 다시 잡는다. 저장분도 같이 갱신해야 복구했을 때 초가 어긋나지 않는다.
      const startedAtMs = Date.now();
      setStartedAt(startedAtMs);
      setElapsedSeconds(0);
      writeActiveJob("face-swap", { jobId, startedAt: startedAtMs });
      toast.success("홍보 이미지를 다시 만들고 있어요.");
    } catch (error) {
      toast.error(errorMessage(error, "다시 시도하지 못했습니다."));
    }
  }

  /**
   * 결과물이 AI 생성물임을 받는 쪽이 알 수 있게 한다.
   * 이미지 위 배지로 상시 표시하고, 밖으로 내보내는 시점에 한 번 더 알린다.
   * 매번 띄우면 잔소리가 되므로 화면당 한 번만 띄운다.
   */
  function handleDownloadNotice() {
    if (downloadNoticeShown) return;
    setDownloadNoticeShown(true);
    toast.info("AI로 만든 이미지입니다. 홍보에 쓰실 때 AI 생성 사실을 함께 표시해주세요.");
  }

  /**
   * 같은 설정으로 다음 사진.
   *
   * 퇴근 후 여러 장을 몰아서 처리하는 흐름인데, 한 장이 끝나면 사진 · 동의 · 얼굴 · 옵션
   * 네 단계를 처음부터 다시 채워야 했다. 얼굴과 배경 설정은 보통 그대로 가므로 남긴다.
   *
   * 동의는 남기지 않는다 — 사진이 바뀌면 손님이 바뀌는 것이라 동의도 새로 받아야 한다.
   * 사진을 교체할 때 handlePhotoChange 가 동의를 지우는 것과 같은 이유다.
   *
   * 만든 결과는 서버에 그대로 두고 화면만 비운다. 삭제는 `작업 삭제` 가 따로 한다.
   */
  function handleNextPhoto() {
    clearActiveJob("face-swap");
    setPhoto(null);
    setPhotoUrl(null);
    setJobPhotoUrl(null);
    setConsentAgreed(false);
    setJobId(null);
    setJob(null);
    setStartedAt(null);
    setElapsedSeconds(0);
    setRequestError(null);
    setRestored(false);
    setPhoneStep(1);
    scrollIntoViewOnNarrow(uploadRef.current);
  }

  async function handleDelete() {
    if (!jobId) return;
    try {
      await deleteFaceSwapJob(jobId);
      clearActiveJob("face-swap");
      removeRecentJob(jobId);
      setRecentRefresh((value) => value + 1);
      setJobId(null);
      setJobPhotoUrl(null);
      setJob(null);
      setStartedAt(null);
      setElapsedSeconds(0);
      setRestored(false);
      setPhoneStep(1);
      toast.success("작업을 삭제했습니다.");
    } catch (error) {
      toast.error(errorMessage(error, "작업을 삭제하지 못했습니다."));
    }
  }

  /**
   * 스트립에서 지난 작업을 눌러 결과 화면을 다시 연다.
   * 원본 사진(File)은 브라우저를 떠난 뒤라 없다 — jobPhotoUrl 을 비워 비교 화면이
   * 어긋난 쌍을 만들지 않게 한다(#109와 같은 규칙). 진행 중에는 스트립이 잠긴다.
   */
  function handleSelectRecent(selected: FaceSwapJobResponse) {
    setJob(selected);
    setJobId(selected.job_id);
    setJobPhotoUrl(null);
    setStartedAt(null);
    setElapsedSeconds(0);
    setRequestError(null);
    setRestored(false);
    setPhoneStep(PHONE_INPUT_STEP_COUNT + 1);
    scrollIntoViewOnNarrow(resultRef.current);
  }

  /**
   * 만들기 버튼 하나를 두 자리에서 그린다 — 데스크톱은 입력 칼럼 끝, 폰은 하단 고정 바.
   * 폰에서 버튼이 화면 밖에 있는 것이 가장 답답한 지점이었다(스크롤 이동은 1차에서
   * 완화했지만, 누르기 전 단계에서는 여전히 안 보인다).
   */
  const generateCta = (
    <Button
      className="w-full transition-[filter] hover:brightness-90 active:brightness-95"
      size="lg"
      style={{ backgroundColor: IDENTITY_INK }}
      onClick={handleGenerate}
      disabled={busy || restoring || !consentAgreed || !isFaceReady(face)}
      aria-describedby={
        !consentAgreed ? "consent-required" : !isFaceReady(face) ? "face-required" : undefined
      }
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      홍보 이미지 만들기
    </Button>
  );

  /**
   * 폰에서 이 단계의 카드를 보여줄지. lg 이상에서는 항상 보인다.
   * 결과 칼럼도 같은 규칙을 쓴다(단계 5). 공용 stepVisibility 에 위임한다
   * (블로그·숏츠와 같은 판정 — Discussion #149 PR 2).
   */
  const phoneOnlyStep = (n: number) => stepVisibility(n, phoneStep);

  // 단계별로 다음으로 넘어갈 조건. 4단계(옵션)는 기본값이 있어 항상 통과한다.
  const stepReady: Record<number, boolean> = {
    1: Boolean(photo),
    2: consentAgreed,
    3: isFaceReady(face),
    4: true,
  };
  const stepHint: Record<number, string> = {
    1: "시술 사진을 올리거나 예시 사진을 골라주세요.",
    2: "사진 활용 동의를 확인해주세요.",
    3: "바꿀 AI 모델을 골라주세요.",
    4: "",
  };

  return (
    <PageShell
      className="pb-28 lg:pb-10"
      title="💇 헤어 모델 만들기"
      description={
        <>
          시술 사진 한 장이면 손님 얼굴 걱정 없이 바로 올릴 홍보 이미지가 나옵니다.
          얼굴만 AI 모델로 바꾸고 공들인 헤어·의상·배경은 그대로 — 동의받은 사진만 올려주세요.
        </>
      }
      badge={
        <Badge
          variant="secondary"
          className="border-0"
          style={{ backgroundColor: IDENTITY_WASH, color: IDENTITY_INK }}
        >
          인스타 피드 · 스토리
        </Badge>
      }
    >
      <StepProgress step={phoneStep} steps={PHONE_STEPS} activeColor={IDENTITY_INK} />

      {/*
        요청 오류는 단계 게이트 밖에서 보여준다. 결과 칼럼(5단계) 안에 두면
        폰에서 입력 단계 도중 실패했을 때 오류가 숨겨진 칼럼에 찍혀 아무것도 안 보인다
        — 실측으로 확인한 버그다.
      */}
      {requestError && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6" ref={uploadRef}>
          <div className={phoneOnlyStep(1)}>
            <Card>
              <CardHeader><CardTitle className="text-base">1. 시술 사진</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {/* 복구 조회가 끝나기 전에 사진을 고르면 굴러들어온 이전 결과와 섞인다 — 잠근다 (#105 리뷰) */}
                <UploadDropzone label="시술 사진" file={photo} onChange={handlePhotoChange} disabled={busy || restoring} />
                <Button variant="outline" size="sm" className="w-full" disabled={busy || restoring} onClick={handleUseSample}>📷 예시 사진으로 체험하기</Button>
              </CardContent>
            </Card>
          </div>

          <div className={phoneOnlyStep(2)}>
            <Card>
              <CardHeader><CardTitle className="text-base">2. {CONSENT_CONTENT.title}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{CONSENT_CONTENT.introduction}</p>
                {/* 예전엔 "자세히 보기" 토글을 열고 체크박스를 또 눌러야 했다(2단계 조작).
                    안내는 항상 보이게 하고, 버튼 하나로 확인을 끝낸다(실측 지적). */}
                <ul className="space-y-2 rounded-md bg-muted/40 p-4 text-sm text-muted-foreground">
                  {CONSENT_CONTENT.details.map((detail) => <li key={detail}>· {detail}</li>)}
                </ul>
                <p className="text-sm text-muted-foreground">{CONSENT_CONTENT.confirmation}</p>
                <Button
                  type="button"
                  variant={consentAgreed ? "secondary" : "default"}
                  className="w-full"
                  disabled={busy}
                  aria-pressed={consentAgreed}
                  onClick={() => setConsentAgreed((prev) => !prev)}
                >
                  {consentAgreed ? (
                    <>
                      <Check className="h-4 w-4" /> 확인 완료
                    </>
                  ) : (
                    "확인했어요"
                  )}
                </Button>
                {!consentAgreed && (
                  <p id="consent-required" role="status" className="text-sm text-amber-700 dark:text-amber-400">
                    동의 확인이 필요합니다.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={phoneOnlyStep(3)}>
            <Card>
              <CardHeader><CardTitle className="text-base">3. AI 모델 고르기</CardTitle></CardHeader>
              <CardContent>
                <FaceOptionForm values={face} onChange={setFace} disabled={requesting || active} />
                {!isFaceReady(face) && (
                  <p id="face-required" role="status" className="mt-4 text-sm text-amber-700 dark:text-amber-400">
                    {face.mode === "reference"
                      ? "바꿀 AI 모델을 골라야 이미지를 만들 수 있습니다."
                      : "국적 · 성별 · 연령대를 골라야 이미지를 만들 수 있습니다."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={phoneOnlyStep(4)}>
            <Card>
              <CardHeader><CardTitle className="text-base">4. 홍보 이미지 옵션</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="mb-2 block">출력 비율</Label>
                  <div className="flex flex-wrap gap-2">
                    {RATIOS.map((ratio) => (
                      <Badge key={ratio} variant="secondary">
                        {ratio} · {RATIO_USAGE[ratio].label}
                        {RATIO_USAGE[ratio].badge && (
                          <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold text-primary">
                            {RATIO_USAGE[ratio].badge}
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    한 번 생성한 결과를 세 규격으로 후처리합니다.
                  </p>
                </div>
                {BACKGROUND_REPLACE_READY && (
                  <>
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
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {SHOW_DEV_TOOLS && (
            <div className={phoneOnlyStep(4)}>
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
            </div>
          )}

          {/* 폰에서는 하단 고정 바가 이 버튼을 대신한다 */}
          <div className="hidden lg:block">{generateCta}</div>
        </div>

        <div
          className={`space-y-5 ${jobId ? phoneOnlyStep(PHONE_INPUT_STEP_COUNT + 1) : phoneOnlyStep(PHONE_INPUT_STEP_COUNT)}`}
          ref={resultRef}
        >
          <h2 className="text-base font-semibold">결과</h2>

          {restored && (
            <Alert>
              <AlertDescription>
                새로고침 전 작업을 이어서 보고 있어요. 업로드했던 원본 사진은 다시 표시할 수 없습니다.
              </AlertDescription>
            </Alert>
          )}

          {!jobId ? (
            restoring ? (
              <Card className="flex aspect-square items-center justify-center border-dashed">
                <p className="max-w-[260px] text-center text-sm text-muted-foreground">
                  이전에 만들던 작업이 있는지 확인하고 있어요.
                </p>
              </Card>
            ) : (
              // 결과 예시(Discussion #149 제안 2) — 랜딩과 같은 컴포넌트·사진 짝을 그대로 쓴다.
              // "표시됩니다" 라고 글로 설명하는 대신, 이 화면이 실제로 만드는 것을 보여준다.
              <Card>
                <CardHeader><CardTitle className="text-base">이런 결과가 나와요</CardTitle></CardHeader>
                <CardContent>
                  <div className="relative">
                    <BeforeAfterSlider
                      beforeUrl="/sample-assets/landing-hero-before.jpg"
                      afterUrl="/sample-assets/landing-hero-swap.jpg"
                      beforeLabel="원본"
                      afterLabel="교체 후"
                    />
                    <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      예시
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    머리·의상·배경은 그대로, 얼굴만 AI 모델로. 사진과 옵션을 채운 뒤 버튼을 누르면
                    직접 만든 결과가 여기에 표시됩니다.
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
            <>
              {active && <FaceSwapWaiting job={job} elapsedSeconds={elapsedSeconds} />}

              {/*
                얼굴 확인이 결과 화면의 첫 순서다. 3규격 저장은 확인이 끝난 뒤의 일이라
                아래로 내렸다. 비교 대상은 4:5 — 세 규격 중 잘리지 않는 권장 규격이다.
              */}
              {photoUrl && resultImages && photoUrl === jobPhotoUrl && (
                <Card>
                  <CardHeader><CardTitle className="text-base">얼굴이 바뀌었는지 확인하세요</CardTitle></CardHeader>
                  <CardContent>
                    <FaceCheck originalUrl={photoUrl} resultUrl={resultImages["4:5"].url} />
                  </CardContent>
                </Card>
              )}

              {photoUrl && (!resultImages || photoUrl !== jobPhotoUrl) && (
                <Card>
                  <CardHeader><CardTitle className="text-base">올린 사진</CardTitle></CardHeader>
                  <CardContent>
                    <div className="relative overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl} alt="업로드한 원본" className="max-h-72 w-full rounded-lg object-contain" />
                      {/* 작업 중임을 사진 위에서도 느끼게 한다. 은은한 맥동 하나로 충분하다. */}
                      {active && <div className="pointer-events-none absolute inset-0 animate-pulse bg-primary/10" />}
                    </div>
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
                    <>
                    <div className="grid gap-4 lg:grid-cols-3">
                      {RATIOS.map((ratio) => {
                        const result = resultImages[ratio];
                        return (
                          <div key={ratio} className="space-y-2">
                            <div className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={result.url} alt={`${ratio} 홍보 이미지`} className="h-56 w-full rounded-lg border bg-muted object-contain" />
                              {/* 실제 사진과 구분되도록 AI 생성 사실을 이미지 위에 표시한다. */}
                              <span className="pointer-events-none absolute right-2 bottom-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                AI 생성
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="flex items-center gap-1">
                                {ratio} · {RATIO_USAGE[ratio].label}
                                {RATIO_USAGE[ratio].badge && (
                                  <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold text-primary">
                                    {RATIO_USAGE[ratio].badge}
                                  </span>
                                )}
                              </span>
                              <Badge variant="outline">{result.format_mode}</Badge>
                            </div>
                            <a href={result.url} download onClick={handleDownloadNotice}>
                              <Button variant="outline" size="sm" className="w-full"><Download className="h-3.5 w-3.5" />다운로드</Button>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                    {/* 보관 기한을 알려야 저장을 미루지 않는다. 지나면 서버에서 지워진다. */}
                    {job?.result_expires_at && (
                      <p className="mt-4 text-xs text-muted-foreground">
                        결과는{" "}
                        {new Date(job.result_expires_at).toLocaleString("ko-KR", {
                          month: "long",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        까지 보관돼요. 쓰실 규격은 지금 저장해두세요.
                      </p>
                    )}
                    {/* 같은 사진·같은 모델이라도 돌릴 때마다 눈매와 입이 조금씩 다르게
                        나온다(seed 를 안 보내 서버가 매번 새로 뽑는다). 원장님이 여러 장
                        중에 마음에 드는 것을 고를 수 있어야 한다.
                        새 job 으로 만든다 — 서버 retry 는 실패한 job 에만 열려 있다.
                        앞 결과는 아래 최근 작업에 남아 있어 되돌아가 볼 수 있다.
                        새로고침으로 복구한 화면에는 원본 파일이 없어 버튼을 숨긴다. */}
                    {photo && (
                      <Button
                        variant="outline"
                        className="mt-4 w-full sm:w-auto"
                        disabled={busy}
                        onClick={handleGenerate}
                      >
                        <RotateCcw className="h-4 w-4" />다시 생성
                      </Button>
                    )}
                    </>
                  ) : job?.status === "failed" ? (
                    <div className="space-y-3">
                      <Alert variant="destructive"><AlertDescription>{jobErrorMessage(job.error, "이미지를 만들지 못했어요. 다시 시도해주세요.")}</AlertDescription></Alert>
                      {job.error?.retryable && <Button variant="outline" onClick={handleRetry}><RotateCcw className="h-4 w-4" />다시 만들기</Button>}
                    </div>
                  ) : (
                    /* 진행 안내는 위 대기 카드 한 곳만 쓴다 — 여기까지 "만들고 있습니다"를
                       두면 한 화면에 같은 말이 두 번 뜬다(8/25 원장님). 이 자리는 결과가
                       어디에 뜨는지만 알려준다. */
                    <p className="text-sm text-muted-foreground">
                      피드 · 스토리 3규격이 여기에 표시됩니다.
                    </p>
                  )}
                </CardContent>
              </Card>

              {job && TERMINAL.has(job.status) && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button size="sm" className="flex-1" onClick={handleNextPhoto}>
                    <Images className="h-3.5 w-3.5" />같은 설정으로 다음 사진
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleDelete}>
                    <Trash2 className="h-3.5 w-3.5" />작업 삭제
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <FaceSwapRecentStrip
        currentJobId={jobId}
        refreshToken={recentRefresh}
        disabled={busy}
        onSelect={handleSelectRecent}
      />

      {phoneStep <= PHONE_INPUT_STEP_COUNT && (
        <StepNav
          step={phoneStep}
          totalSteps={PHONE_INPUT_STEP_COUNT}
          canGoNext={stepReady[phoneStep]}
          nextHint={stepHint[phoneStep]}
          onPrev={() => {
            if (busy) return;
            setPhoneStep((n) => Math.max(1, n - 1));
          }}
          onNext={() => setPhoneStep((n) => Math.min(PHONE_INPUT_STEP_COUNT, n + 1))}
          cta={generateCta}
        />
      )}

      <DevNote
        guideExample="MOCK-001 · 얼굴 교체 job 종단 흐름"
        owner="이미지 생성 · 서비스·UI · 서빙·인프라 담당"
        engines={["Next.js Route Handler mock", "MediaPipe + SDXL 인페인팅(후속 VM 프록시 연결)"]}
        preserve="헤어 · 의상 · 배경 · 포즈"
        change="얼굴(신원)만"
        steps={["참조 얼굴 목록을 /api/v1/reference-faces에서 조회", "사진과 옵션(얼굴 포함)을 multipart로 /api/v1/face-swap-jobs에 전송", "2초마다 얼굴 교체 job 상태 확인", "완료된 3규격 이미지 표시", "재시도 가능한 job 전체 재시도", "완료 뒤 작업 삭제 가능(진행 중에는 409)"]}
        codeHint={`// 얼굴 교체·블로그·영상은 각각 독립 job
// 서버 기본값 mock, 인증·HTTPS 준비 후 proxy 구현
// 진행 시간은 안내 문구에만 사용하고 실패는 서버 상태로 판정`}
      />
    </PageShell>
  );
}
