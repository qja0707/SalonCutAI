"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Captions,
  CheckCircle2,
  Download,
  Film,
  Info,
  LoaderCircle,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { ClipFilmstrip } from "@/components/shorts/clip-filmstrip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  StepNav,
  StepProgress,
  scrollIntoViewOnNarrow,
  stepVisibility,
} from "@/components/flow/step-flow";
import {
  createVideoJob,
  createVideoCaptions,
  deleteVideoJob,
  getVideoJob,
  videoJobUrl,
} from "@/lib/api-client/client";
import type {
  VideoAudioMode,
  VideoClipOptions,
  VideoJobResponse,
  VideoRole,
  VideoSelection,
} from "@/lib/api-client/types";
import { errorMessage, jobErrorMessage } from "@/lib/api-client/error-message";

type DescriptionMode = "preset" | "custom";
type ClipDraft = VideoClipOptions & {
  id: string;
  file: File;
  description: string;
  descriptionMode: DescriptionMode;
};
type ClipDraftChanges = Partial<VideoClipOptions> & {
  description?: string;
  descriptionMode?: DescriptionMode;
};
type UploadIssue = { title: string; messages: string[] };
const MIB = 1024 * 1024;
const MAX_FILE_BYTES = 160 * MIB;
const MAX_TOTAL_BYTES = 320 * MIB;
const MAX_CAPTION_CONTEXT_LENGTH = 100;
const CUSTOM_DESCRIPTION_VALUE = "__custom__";
const ACCEPTED_VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv"]);

/** 결과까지 포함한 단계 수. 진행 표시는 입력 2단계만 센다 — 클립별 카드는 쪼개지 않는다,
 * 클립이 8개면 8단계가 되어 버린다(Discussion #149). */
const PHONE_STEPS = ["영상 업로드", "세부 조정(선택)"] as const;
const PHONE_INPUT_STEP_COUNT = 2;

/**
 * 목적지 색(Discussion #149 3번) — 인스타 릴스. 얼굴 교체와 목적지가 같아(둘 다
 * 인스타) 그라디언트 양 끝을 나눠 쓴다 — 숏폼은 주황·노랑 끝. 흰 글자 5.18:1,
 * wash 위 4.60:1 — 둘 다 WCAG AA 통과.
 */
const IDENTITY_INK = "#C2410C";
const IDENTITY_WASH = "#fdefe4";

/**
 * 서버가 받는 기준과 같게 판정한다 — backend `video_jobs.py` 의
 * `ALLOWED_SUFFIXES` 도 MIME 이 아니라 확장자를 본다.
 *
 * 전에는 `file.type.startsWith("video/")` 를 OR 로 함께 봤는데, accept 를
 * `video/*` 로 넓히자 AVI 처럼 서버가 안 받는 형식까지 화면에서는 통과해
 * 업로드 단계에서야 415 로 떨어졌다. 고르는 자리에서 바로 알려주는 편이 낫다.
 */
function isAcceptedVideoFile(file: File): boolean {
  const extension = file.name.includes(".")
    ? `.${file.name.split(".").pop()?.toLowerCase()}`
    : "";
  return ACCEPTED_VIDEO_EXTENSIONS.has(extension);
}

function fileSizeLabel(bytes: number): string {
  return `${(bytes / MIB).toFixed(1)}MB`;
}

function createClipId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const ROLE_OPTIONS: { value: VideoRole; label: string; caption: string }[] = [
  { value: "before", label: "시술 전", caption: "시술 전, 오늘의 변화를 시작합니다" },
  { value: "process", label: "시술 과정", caption: "섬세하게 완성해 가는 시술 과정" },
  { value: "detail", label: "디테일", caption: "작은 디테일까지 꼼꼼하게" },
  { value: "after", label: "마무리", caption: "완성된 스타일을 확인해 보세요" },
];

const SELECTION_OPTIONS: { value: VideoSelection; label: string }[] = [
  { value: "start", label: "앞 2초" },
  { value: "center", label: "가운데 2초" },
  { value: "end", label: "뒤 2초" },
];

/**
 * 결과 예시(Discussion #149 제안 2) — 랜딩의 SHORTS_CLIPS 와 같은 문구. 빈 결과
 * 자리에 "9:16 · 무음" 프레임과 클립 목록을 그대로 보여준다 — 만들기 전에는
 * "완성 영상이 여기에 표시됩니다" 라는 글자뿐이었다(#149 실측).
 */
const EXAMPLE_CLIPS = [
  { role: "시술 과정", caption: "섬세하게 완성해 가는 시술 과정", sec: "0:06" },
  { role: "디테일", caption: "작은 디테일까지 꼼꼼하게", sec: "0:05" },
  { role: "마무리", caption: "완성된 스타일을 확인해 보세요", sec: "0:04" },
] as const;

const DESCRIPTION_OPTIONS = [
  "시술 전 상태",
  "두피·모발 진단",
  "샴푸",
  "커트",
  "섹션 나누기",
  "염색약 도포",
  "탈색약 도포",
  "호일·롤 작업",
  "펌 와인딩",
  "방치·처리 중",
  "중화·헹굼",
  "드라이",
  "아이론·열기구",
  "스타일링 마무리",
  "완성 확인",
] as const;

function defaultRole(index: number, total: number): VideoRole {
  if (index === 0) return "before";
  if (index === total - 1) return "after";
  return index % 2 ? "process" : "detail";
}

export function ShortsGenerator() {
  const [clips, setClips] = useState<ClipDraft[]>([]);
  const [job, setJob] = useState<VideoJobResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [blurFaces, setBlurFaces] = useState(true);
  const [audioMode, setAudioMode] = useState<VideoAudioMode>("mute");
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [orderEdited, setOrderEdited] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  const [uploadIssue, setUploadIssue] = useState<UploadIssue | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoDraftedRef = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  // 폰 단계식(A안, Discussion #149 — 얼굴 교체·블로그와 같은 흐름)에서 지금 보여줄 단계.
  // 1~2 는 입력, 3 은 결과. lg 이상에서는 쓰이지 않는다 — 카드가 전부 렌더된다.
  const [phoneStep, setPhoneStep] = useState(1);

  useEffect(() => {
    if (!job || !["queued", "processing"].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await getVideoJob(job.job_id);
        setJob(next);
        if (next.status === "failed") {
          // 원문은 화면에 올리지 않는다 — 내부 경로·인자가 섞여 나올 수 있다(#119 리뷰).
          // 진단용 원문은 jobErrorMessage 안에서 서버 오류 로그로 넘어간다.
          setError(jobErrorMessage(next.error, "영상을 만들지 못했어요. 잠시 후 다시 시도해주세요."));
        }
      } catch (pollError) {
        setError(errorMessage(pollError, "작업 상태를 확인하지 못했습니다."));
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const candidates = Array.from(files);
    const available = Math.max(0, 8 - clips.length);
    const accepted: File[] = [];
    const messages: string[] = [];
    let totalLimitReported = false;
    let totalBytes = clips.reduce((sum, clip) => sum + clip.file.size, 0);

    for (const [index, file] of candidates.entries()) {
      if (!isAcceptedVideoFile(file)) {
        messages.push(`${file.name}: MP4, MOV, WEBM, MKV 형식만 지원합니다.`);
        continue;
      }
      if (accepted.length >= available) {
        messages.push(
          `최대 8개까지 추가할 수 있어 나머지 ${candidates.length - index}개는 제외했습니다.`,
        );
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        messages.push(
          `${file.name}: 160MB를 초과했습니다. 현재 크기 ${fileSizeLabel(file.size)}`,
        );
        continue;
      }
      if (totalBytes + file.size > MAX_TOTAL_BYTES) {
        if (!totalLimitReported) {
          messages.push(
            `${file.name}: 전체 업로드 한도 320MB를 초과해 제외했습니다. 추가 전 합계 ${fileSizeLabel(totalBytes)}`,
          );
          totalLimitReported = true;
        }
        continue;
      }
      accepted.push(file);
      totalBytes += file.size;
    }
    if (accepted.length) {
      const total = clips.length + accepted.length;
      const addedClips = accepted.map((file, offset) => {
        // 첫 배치만 전→과정→…→마무리 흐름으로 배정한다. 클립이 이미 있을 때 이 규칙을
        // 다시 적용하면 '마무리'가 둘이 된다 — 기존 배정(수동 지정 포함)은 건드리지 않고,
        // 나중에 온 클립은 중간 성격인 '디테일'로 둔다.
        const role: VideoRole = clips.length === 0 ? defaultRole(offset, total) : "detail";
        return {
          id: createClipId(),
          file,
          role,
          selection: "center" as const,
          description: "",
          descriptionMode: "preset" as const,
          caption: ROLE_OPTIONS.find((option) => option.value === role)?.caption || "",
        };
      });
      const nextClips = [...clips, ...addedClips];
      setClips(nextClips);
      setActiveClipId((current) => current ?? nextClips[0].id);
      if (
        clips.length < 2 &&
        nextClips.length >= 2 &&
        !autoDraftedRef.current
      ) {
        autoDraftedRef.current = true;
        void submitDraft(nextClips);
      }
    }
    setUploadIssue(
      messages.length
        ? {
            title: accepted.length ? "일부 영상을 추가하지 못했어요" : "영상을 추가하지 못했어요",
            messages,
          }
        : null,
    );
    if (inputRef.current) inputRef.current.value = "";
  }

  function updateClip(id: string, changes: ClipDraftChanges) {
    setClips((current) => current.map((clip) => (clip.id === id ? { ...clip, ...changes } : clip)));
  }

  function removeClip(id: string) {
    const removedIndex = clips.findIndex((clip) => clip.id === id);
    const nextClips = clips.filter((clip) => clip.id !== id);
    setClips(nextClips);
    if (activeClipId === id) {
      setActiveClipId(nextClips[Math.min(removedIndex, nextClips.length - 1)]?.id ?? null);
    }
    if (nextClips.length === 0) {
      autoDraftedRef.current = false;
      setBlurFaces(true);
      setAudioMode("mute");
      setOrderEdited(false);
      setDetailsOpen(false);
      setUploadIssue(null);
    }
  }

  function moveClip(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= clips.length) return;
    const nextClips = [...clips];
    [nextClips[index], nextClips[target]] = [nextClips[target], nextClips[index]];
    setClips(nextClips);
    setOrderEdited(true);
  }

  function openDetails() {
    setDetailsOpen(true);
    setPhoneStep(PHONE_INPUT_STEP_COUNT);
    window.requestAnimationFrame(() => scrollIntoViewOnNarrow(editorRef.current));
  }

  async function submitDraft(clipsToSubmit: ClipDraft[] = clips) {
    if (clipsToSubmit.length < 2) {
      setError("시술 전후 흐름을 위해 영상을 2개 이상 올려주세요.");
      return;
    }
    setSubmitting(true);
    setJob(null);
    setError("");
    setPhoneStep(PHONE_INPUT_STEP_COUNT + 1);
    window.requestAnimationFrame(() => scrollIntoViewOnNarrow(resultRef.current));
    try {
      const created = await createVideoJob(
        clipsToSubmit.map(
          ({ file, role, selection, caption, start_sec, end_sec, keep_audio }, index) => ({
            file,
            options: {
              role,
              selection,
              caption,
              ...(start_sec !== undefined && end_sec !== undefined
                ? { start_sec, end_sec }
                : {}),
              ...(orderEdited ? { clip_order: index } : {}),
              ...(audioMode === "original"
                ? { keep_audio: keep_audio !== false }
                : {}),
            },
          }),
        ),
        blurFaces,
        audioMode,
      );
      setJob(await getVideoJob(created.job_id));
    } catch (submitError) {
      setError(errorMessage(submitError, "영상 작업을 접수하지 못했습니다."));
      openDetails();
    } finally {
      setSubmitting(false);
    }
  }

  async function generateCaptions() {
    if (clips.length < 2) {
      setError("AI 자막 생성을 위해 영상을 2개 이상 올려주세요.");
      return;
    }
    setGeneratingCaptions(true);
    setError("");
    try {
      const response = await createVideoCaptions(
        clips.map(({ role, description }, index) => ({
          index,
          role,
          description: description.trim() || undefined,
        })),
        topic.trim(),
      );
      setClips((current) =>
        current.map((clip, index) => ({
          ...clip,
          caption: response.captions[index]?.caption ?? clip.caption,
        })),
      );
    } catch (captionError) {
      setError(
        errorMessage(captionError, "AI 자막 생성에 실패했습니다. 기본 문구를 직접 수정해 계속해주세요."),
      );
    } finally {
      setGeneratingCaptions(false);
    }
  }

  async function reset() {
    if (job && !["queued", "processing"].includes(job.status)) {
      await deleteVideoJob(job.job_id).catch(() => undefined);
    }
    setJob(null);
    setClips([]);
    setTopic("");
    setBlurFaces(true);
    setAudioMode("mute");
    setActiveClipId(null);
    setOrderEdited(false);
    setDetailsOpen(false);
    autoDraftedRef.current = false;
    setError("");
    setUploadIssue(null);
    setPhoneStep(1);
  }

  const busy =
    submitting ||
    generatingCaptions ||
    job?.status === "queued" ||
    job?.status === "processing";

  const activeClip = clips.find((clip) => clip.id === activeClipId) ?? clips[0] ?? null;
  const activeClipIndex = activeClip
    ? clips.findIndex((clip) => clip.id === activeClip.id)
    : -1;
  const expectedSeconds = clips.reduce(
    (sum, clip) =>
      sum +
      (clip.start_sec !== undefined && clip.end_sec !== undefined
        ? clip.end_sec - clip.start_sec
        : 2),
    0,
  );
  const expectedSecondsLabel = expectedSeconds.toFixed(1).replace(/\.0$/, "");

  // 만들기 버튼 하나를 두 자리에서 그린다 — 데스크톱은 제목 옆, 폰은 하단 고정 바.
  const generateCta = (
    <Button
      onClick={() => submitDraft()}
      disabled={busy || clips.length < 2}
      className="w-full transition-[filter] hover:brightness-90 active:brightness-95"
      style={{ backgroundColor: IDENTITY_INK }}
    >
      {busy ? <LoaderCircle className="animate-spin" /> : <Film />}
      {job || autoDraftedRef.current ? "변경사항으로 다시 만들기" : "숏츠 만들기"}
    </Button>
  );

  const stepReady: Record<number, boolean> = {
    1: clips.length >= 2,
    2: clips.length >= 2,
  };
  const stepHint: Record<number, string> = {
    1: "영상을 2개 이상 올려주세요.",
    2: "",
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:py-12 lg:pb-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="border-0"
              style={{ backgroundColor: IDENTITY_WASH, color: IDENTITY_INK }}
            >
              인스타 릴스 · 스토리
            </Badge>
          </div>
          {/* 대제목은 릴스로 통일(Discussion #149) — 배지("인스타 릴스 · 스토리")와
              맞춘다. 메뉴는 AI 숏츠 만들기 그대로 — 역할 분리(8/17 원장님) */}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">🎬 간편 릴스 만들기</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            찍어둔 클립만 고르면 9:16 릴스로 자동 편집돼요.
          </p>
        </div>
        <div className="hidden lg:block lg:shrink-0 lg:pt-1">{generateCta}</div>
      </div>

      <Alert className="mb-6 border-primary/20 bg-primary/5 px-4 py-3">
        <ShieldCheck className="text-primary" />
        <AlertTitle>얼굴 블러는 한 명만 자동으로 적용돼요</AlertTitle>
        <AlertDescription>
          나머지 얼굴은 그대로 나옵니다. 올리기 전에 완성 영상을 확인해주세요.
        </AlertDescription>
      </Alert>

      <StepProgress step={phoneStep} steps={PHONE_STEPS} activeColor={IDENTITY_INK} />

      {/*
        요청 오류는 단계 게이트 밖에서 보여준다. 결과 칼럼(3단계) 안에 두면
        폰에서 입력 단계 도중 실패했을 때 오류가 숨겨진 칼럼에 찍혀 아무것도 안 보인다
        — 얼굴 교체·블로그 화면에서 같은 이유로 이미 고친 문제다.
      */}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <Info />
          <AlertTitle>확인이 필요합니다</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:mt-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-6">
          <Card className={stepVisibility(1, phoneStep)}>
            {/* 폰에서는 위 단계 표시가 같은 말을 하고 있다 — lg 에서만 제목을 둔다. */}
            <CardHeader className="hidden lg:grid">
              <CardTitle>영상 업로드</CardTitle>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy || clips.length >= 8}
                className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="mb-3 h-8 w-8 text-primary" />
                <span className="font-medium">영상 선택하기</span>
                <span className="mt-1 text-xs text-muted-foreground">2~8개 · 파일당 160MB</span>
              </button>
              <Input
                ref={inputRef}
                type="file"
                // 특정 MIME 나열(video/mp4,video/quicktime,...)이 아이폰 사파리에서
                // 사진 앱의 영상 필터를 깨뜨려 업로드 자체가 안 되는 문제가 있었다
                // (실측: 아이폰 사파리에서 재현). 실제 허용 여부는 accept 가 아니라
                // isAcceptedVideoFile()이 이미 video/* 전부 + 확장자로 넉넉하게
                // 검증하므로, accept 는 OS 선택창 필터 힌트만 넓게 줘도 안전하다.
                accept="video/*"
                multiple
                className="hidden"
                onChange={(event) => addFiles(event.target.files)}
              />
              {uploadIssue && (
                <Alert variant="destructive" className="mt-4 min-w-0">
                  <Info />
                  <AlertTitle>{uploadIssue.title}</AlertTitle>
                  <AlertDescription>
                    <ul className="space-y-1">
                      {uploadIssue.messages.map((message, index) => (
                        <li key={`${index}-${message}`} className="break-words [overflow-wrap:anywhere]">
                          {message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {clips.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  클립 {clips.length}개 · 예상 {expectedSecondsLabel}초
                </p>
              )}
            </CardContent>
          </Card>

          {clips.length > 0 && (
            <div ref={editorRef} className={stepVisibility(2, phoneStep)}>
            <Card>
              <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>세부 조정</CardTitle>
                  <CardDescription className="mt-2">
                    그대로 만들어도 되고, 필요할 때만 바꾸면 돼요.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen((open) => !open)}
                >
                  {detailsOpen ? "세부 조정 닫기" : "세부 조정 열기"}
                </Button>
              </CardHeader>
              {detailsOpen && activeClip && (
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="blur-faces">얼굴 블러 적용</Label>
                        <Switch
                          id="blur-faces"
                          checked={blurFaces}
                          disabled={busy}
                          onCheckedChange={setBlurFaces}
                        />
                      </div>
                      {!blurFaces && (
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">
                          본인만 등장하거나 모든 출연자에게 촬영·게시 동의를 받은 영상에서만
                          꺼주세요.
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="original-audio">원본 음성 사용</Label>
                        <Switch
                          id="original-audio"
                          checked={audioMode === "original"}
                          disabled={busy}
                          onCheckedChange={(checked) =>
                            setAudioMode(checked ? "original" : "mute")
                          }
                        />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        끄면 모든 클립을 무음으로 만듭니다.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div className="space-y-2">
                        <Label htmlFor="caption-topic">시술명 또는 홍보 주제 (선택)</Label>
                        <Input
                          id="caption-topic"
                          value={topic}
                          maxLength={MAX_CAPTION_CONTEXT_LENGTH}
                          disabled={busy}
                          placeholder="예: 레이어드컷, 여름 스타일 변신"
                          onChange={(event) => setTopic(event.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={generateCaptions}
                        disabled={busy || clips.length < 2}
                      >
                        {generatingCaptions ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Sparkles />
                        )}
                        {generatingCaptions ? "AI 자막 만드는 중" : "AI로 자막 만들기"}
                      </Button>
                    </div>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                      <li>AI는 입력한 장면 설명과 주제만 사용해 자막 초안을 만듭니다.</li>
                      <li>영상·대표 프레임·사용 구간은 AI 자막 요청에 전송되지 않습니다.</li>
                      <li>버튼을 누르지 않으면 기본 문구를 직접 수정해 사용할 수 있습니다.</li>
                    </ul>
                  </div>

                  <div
                    className="flex gap-2 overflow-x-auto pb-1"
                    role="tablist"
                    aria-label="조정할 클립"
                  >
                    {clips.map((clip, index) => (
                      <Button
                        key={clip.id}
                        type="button"
                        role="tab"
                        size="sm"
                        variant={clip.id === activeClip.id ? "secondary" : "outline"}
                        aria-selected={clip.id === activeClip.id}
                        className="max-w-44 shrink-0"
                        onClick={() => setActiveClipId(clip.id)}
                      >
                        <span className="truncate">{index + 1}. {clip.file.name}</span>
                      </Button>
                    ))}
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {activeClipIndex + 1}. {activeClip.file.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(activeClip.file.size / MIB).toFixed(1)}MB
                          {orderEdited ? " · 순서 직접 조정됨" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={busy || activeClipIndex <= 0}
                          onClick={() => moveClip(activeClipIndex, -1)}
                          aria-label={`${activeClip.file.name} 앞으로 이동`}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={busy || activeClipIndex >= clips.length - 1}
                          onClick={() => moveClip(activeClipIndex, 1)}
                          aria-label={`${activeClip.file.name} 뒤로 이동`}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          onClick={() => removeClip(activeClip.id)}
                          aria-label={`${activeClip.file.name} 제거`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`role-${activeClip.id}`}>컷 역할</Label>
                        <Select
                          value={activeClip.role}
                          disabled={busy}
                          onValueChange={(value) => {
                            if (!value) return;
                            const role = value as VideoRole;
                            updateClip(activeClip.id, {
                              role,
                              caption:
                                ROLE_OPTIONS.find((option) => option.value === role)?.caption ||
                                activeClip.caption,
                            });
                          }}
                        >
                          <SelectTrigger id={`role-${activeClip.id}`} className="w-full">
                            <SelectValue>
                              {(value: VideoRole) => ROLE_OPTIONS.find((option) => option.value === value)?.label ?? value}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`selection-${activeClip.id}`}>기본 사용 구간</Label>
                        <Select
                          value={activeClip.selection}
                          disabled={busy}
                          onValueChange={(value) =>
                            value &&
                            updateClip(activeClip.id, {
                              selection: value as VideoSelection,
                            })
                          }
                        >
                          <SelectTrigger id={`selection-${activeClip.id}`} className="w-full">
                            <SelectValue>
                              {(value: VideoSelection) => SELECTION_OPTIONS.find((option) => option.value === value)?.label ?? value}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {SELECTION_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>정밀 구간</Label>
                      <ClipFilmstrip
                        key={activeClip.id}
                        file={activeClip.file}
                        startSec={activeClip.start_sec}
                        endSec={activeClip.end_sec}
                        disabled={busy}
                        onRangeChange={(start_sec, end_sec) =>
                          updateClip(activeClip.id, {
                            start_sec: Number(start_sec.toFixed(1)),
                            end_sec: Number(end_sec.toFixed(1)),
                          })
                        }
                        onResetRange={() =>
                          updateClip(activeClip.id, {
                            start_sec: undefined,
                            end_sec: undefined,
                          })
                        }
                      />
                    </div>
                    {audioMode === "original" && (
                      <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
                        <Label htmlFor={`keep-audio-${activeClip.id}`}>이 클립 원음 유지</Label>
                        <Switch
                          id={`keep-audio-${activeClip.id}`}
                          checked={activeClip.keep_audio !== false}
                          disabled={busy}
                          onCheckedChange={(keep_audio) =>
                            updateClip(activeClip.id, { keep_audio })
                          }
                        />
                      </div>
                    )}
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`description-choice-${activeClip.id}`}>장면 설명 (선택)</Label>
                      <Select
                        value={
                          activeClip.descriptionMode === "custom"
                            ? CUSTOM_DESCRIPTION_VALUE
                            : activeClip.description || null
                        }
                        disabled={busy}
                        onValueChange={(value) => {
                          if (!value) return;
                          if (value === CUSTOM_DESCRIPTION_VALUE) {
                            updateClip(activeClip.id, {
                              description: "",
                              descriptionMode: "custom",
                            });
                            return;
                          }
                          updateClip(activeClip.id, {
                            description: value,
                            descriptionMode: "preset",
                          });
                        }}
                      >
                        <SelectTrigger id={`description-choice-${activeClip.id}`} className="w-full">
                          <SelectValue placeholder="장면 설명을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {DESCRIPTION_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                          <SelectSeparator />
                          <SelectItem value={CUSTOM_DESCRIPTION_VALUE}>직접 입력</SelectItem>
                        </SelectContent>
                      </Select>
                      {activeClip.descriptionMode === "custom" && (
                        <Input
                          id={`description-${activeClip.id}`}
                          value={activeClip.description}
                          maxLength={MAX_CAPTION_CONTEXT_LENGTH}
                          disabled={busy}
                          aria-label={`${activeClipIndex + 1}번 장면 설명 직접 입력`}
                          placeholder="장면 설명을 직접 입력하세요"
                          onChange={(event) =>
                            updateClip(activeClip.id, { description: event.target.value })
                          }
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        AI가 영상을 보지 않으므로 자막에 반영할 내용만 적어주세요.
                      </p>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`caption-${activeClip.id}`} className="flex items-center gap-2"><Captions className="h-4 w-4" />자막</Label>
                      <Input
                        id={`caption-${activeClip.id}`}
                        value={activeClip.caption}
                        maxLength={80}
                        disabled={busy}
                        onChange={(event) =>
                          updateClip(activeClip.id, { caption: event.target.value })
                        }
                      />
                    </div>
                  </div>
                  {clips.length < 8 && (
                    <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
                      <Plus />영상 추가
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
            </div>
          )}
        </section>

        <aside
          ref={resultRef}
          className={stepVisibility(
            submitting || job ? PHONE_INPUT_STEP_COUNT + 1 : PHONE_INPUT_STEP_COUNT,
            phoneStep,
          )}
        >
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>결과</CardTitle>
              <CardDescription>
                세로형 {audioMode === "original" ? "원음 포함" : "무음"} MP4로 생성됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {job?.status === "completed" ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl bg-black">
                    <video className="aspect-[9/16] w-full" controls playsInline src={videoJobUrl(job.job_id)} />
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2 text-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />영상 생성 완료</p>
                    <p className="mt-2">길이 {job.result?.duration_sec.toFixed(1)}초 · 처리 {job.meta?.processing_sec.toFixed(1)}초</p>
                    <p className="mt-1">
                      {job.meta?.blur_faces === false
                        ? "얼굴 블러 꺼짐"
                        : `얼굴 검출·블러 ${job.meta?.faces_blurred ?? 0}회`}
                    </p>
                    <p className="mt-1">
                      {job.meta?.audio_included ? "원본 음성 포함" : "무음 영상"}
                    </p>
                    <p className="mt-1">원본과 결과는 24시간 후 삭제돼요.</p>
                  </div>
                  <a
                    href={videoJobUrl(job.job_id)}
                    download="saloncutai-shorts.mp4"
                    className={buttonVariants({ className: "w-full" })}
                  >
                    <Download />MP4 다운로드
                  </a>
                  <Button variant="outline" className="w-full" onClick={reset}>새 영상 만들기</Button>
                </div>
              ) : submitting || (busy && job) ? (
                <div className="py-10 text-center">
                  <LoaderCircle className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                  <p className="font-medium">영상을 편집하고 있습니다</p>
                  <p className="mt-2 text-xs text-muted-foreground">브라우저를 닫지 말고 잠시 기다려주세요</p>
                  <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(4, job?.progress ?? 0)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{job?.progress ?? 0}%</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border bg-gradient-to-b from-muted to-muted-foreground/25">
                    <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-background/90 shadow">
                      <Play className="ml-0.5 h-5 w-5" />
                    </span>
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white">
                      9:16 · {audioMode === "original" ? "원음 포함" : "무음"}
                    </span>
                    <span className="absolute top-3 right-3 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      예시
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {EXAMPLE_CLIPS.map((clip) => (
                      <li key={clip.role} className="rounded-xl border bg-card px-3 py-2 text-xs text-card-foreground">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <Captions className="h-3.5 w-3.5 text-primary" />
                          {clip.role}
                          <span className="ml-auto font-normal text-muted-foreground">{clip.sec}</span>
                        </p>
                        <p className="mt-1 truncate text-muted-foreground">&ldquo;{clip.caption}&rdquo;</p>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs leading-5 text-muted-foreground">
                    영상을 2개 이상 올리면 바로 만들기 시작해요.
                  </p>
                </div>
              )}
              {clips.length >= 2 && (
                <Button type="button" variant="outline" className="mt-4 w-full" onClick={openDetails}>
                  세부 조정
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {phoneStep <= PHONE_INPUT_STEP_COUNT && (
        <StepNav
          step={phoneStep}
          totalSteps={PHONE_INPUT_STEP_COUNT}
          canGoNext={stepReady[phoneStep]}
          nextHint={stepHint[phoneStep]}
          onPrev={() => setPhoneStep((n) => Math.max(1, n - 1))}
          onNext={() => setPhoneStep((n) => Math.min(PHONE_INPUT_STEP_COUNT, n + 1))}
          cta={generateCta}
          width="max-w-7xl"
        />
      )}
    </div>
  );
}
