"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Captions,
  ChevronRight,
  Download,
  Film,
  Info,
  LoaderCircle,
  LogIn,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ClipFilmstrip,
  MAX_RANGE_SECONDS,
  MIN_RANGE_SECONDS,
} from "@/components/shorts/clip-filmstrip";
import { ensureFreshSession, hasSession } from "@/lib/session";
import { StepNav, stepVisibility } from "@/components/flow/step-flow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { scrollIntoViewOnNarrow } from "@/components/flow/step-flow";
import { ShortsSteps } from "@/app/generate/shorts/step-indicator";
import {
  createVideoJob,
  createVideoCaptions,
  deleteVideoJob,
  getVideoJob,
  videoJobUrl,
} from "@/lib/api-client/client";
import type {
  VideoAudioMode,
  VideoJobResponse,
  VideoRole,
  VideoSelection,
} from "@/lib/api-client/types";
import { errorMessage, jobErrorMessage } from "@/lib/api-client/error-message";
import {
  CUSTOM_DESCRIPTION_VALUE,
  DEFAULT_CLIP_SECONDS,
  DESCRIPTION_OPTIONS,
  DURATION_EPSILON_SECONDS,
  EXAMPLE_SHOTS,
  IDENTITY_INK,
  IDENTITY_WASH,
  LONG_RUNNING_SECONDS,
  MAX_CAPTION_CONTEXT_LENGTH,
  MAX_CLIPS,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  MAX_TOTAL_SECONDS,
  MIB,
  MIN_CLIPS,
  ROLE_OPTIONS,
  SELECTION_OPTIONS,
  buildCaptionPrompt,
  createClipId,
  defaultRole,
  fileSizeLabel,
  isAcceptedVideoFile,
  progressStage,
} from "@/app/generate/shorts/shared";
import type {
  ClipDraft,
  ClipDraftChanges,
  UploadIssue,
} from "@/app/generate/shorts/shared";

const MOOD_OPTIONS = ["감성", "전문", "친근", "예약 유도"] as const;
type MoodOption = (typeof MOOD_OPTIONS)[number];

function simpleRoleLabel(role: VideoRole): string {
  if (role === "before") return "시술 전";
  if (role === "after") return "완성";
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

function ClipThumbnail({ file, label }: { file: File; label: string }) {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <video
      src={`${previewUrl}#t=0.1`}
      muted
      playsInline
      preload="metadata"
      aria-label={`${label} 영상 미리보기`}
      className="aspect-video w-full bg-black object-cover"
      onLoadedData={(event) => {
        if (event.currentTarget.duration > 0.2) event.currentTarget.currentTime = 0.1;
      }}
    />
  );
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
  /* 컷 편집 드로어. 목록에서 컷을 누르면 열린다. */
  const [editorOpen, setEditorOpen] = useState(false);
  /* 폰에서 지금 보고 있는 단계. lg 이상은 카드를 전부 그리므로 쓰이지 않는다. */
  const [phoneStep, setPhoneStep] = useState<1 | 2 | 3>(1);
  const [topic, setTopic] = useState("");
  const [mood, setMood] = useState<MoodOption | "">("");
  const [editingResult, setEditingResult] = useState(false);
  const [error, setError] = useState("");
  const [uploadIssue, setUploadIssue] = useState<UploadIssue | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [dragging, setDragging] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  // 서버 progress 위에 얹는 추정 진행률과 경과 시간. 바가 멈춰 보이지 않게 하는 용도라
  // 실제 작업량이 아니라 시간으로만 움직인다 — 그래서 화면에도 "약" 을 붙여 적는다.
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const loginNoticeRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  // 폰 단계식(A안, Discussion #149 — 얼굴 교체·블로그와 같은 흐름)에서 지금 보여줄 단계.
  // 1~2 는 입력, 3 은 결과. lg 이상에서는 쓰이지 않는다 — 카드가 전부 렌더된다.
  const rendering =
    submitting || job?.status === "queued" || job?.status === "processing";
  const serverProgress = job?.progress ?? 0;
  const serverProgressRef = useRef(0);
  const captionPrompt = buildCaptionPrompt(topic, mood);

  useEffect(() => {
    serverProgressRef.current = serverProgress;
  }, [serverProgress]);

  /**
   * 바가 멈춰 보이지 않게 250ms 마다 조금씩 채운다. 서버 값이 갱신되면 그 값으로
   * 곧장 따라붙고(`Math.max`), 갱신이 없는 동안에는 같은 단계의 상한까지만 기어간다.
   * 서버 progress 를 의존성에 넣으면 타이머가 다시 만들어져 경과 시간이 0 으로
   * 돌아가므로, 최신값은 ref 로 읽는다.
   */
  useEffect(() => {
    if (!rendering) return;
    const startedAt = Date.now();
    // 이번 실행의 진행률은 지역 변수로 들고 간다 — 실행이 시작될 때마다 0 에서
    // 출발하므로 따로 초기화할 필요가 없고, setState 도 타이머 안에서만 부른다.
    let estimate = 0;
    const timer = window.setInterval(() => {
      const server = serverProgressRef.current;
      estimate = Math.min(
        progressStage(server).ceiling,
        Math.max(estimate, server) + 0.15,
      );
      setSmoothProgress(estimate);
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [rendering]);

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

  /**
   * 만드는 중에는 진행 표시가 있는 ② 자동 편집 카드로, 다 되면 결과가 있는 ③ 저장
   * 카드로 데려간다. 폰에서만 움직인다(`scrollIntoViewOnNarrow`).
   *
   * `requestAnimationFrame` 으로 부르던 것을 effect 로 옮겼다 — 영상을 담는 순간 ① 카드
   * 높이가 크게 바뀌는데(예시 3컷이 빠지고 순서 목록이 들어온다), rAF 가 그 리렌더보다
   * 먼저 돌면 옛 위치로 스크롤해 아무 데도 가지 않았다(#195 리뷰).
   */
  const scrolledToProgressRef = useRef(false);
  useEffect(() => {
    if (rendering) {
      // 한 번 만들 때 한 번만 데려간다. status 가 queued → processing 으로 바뀔 때도
      // effect 가 다시 도는데, 그때마다 끌어당기면 보고 있던 자리에서 밀려난다.
      if (!scrolledToProgressRef.current) {
        scrolledToProgressRef.current = true;
        scrollIntoViewOnNarrow(editorRef.current);
      }
      return;
    }
    scrolledToProgressRef.current = false;
    if (job?.status === "completed") {
      scrollIntoViewOnNarrow(resultRef.current);
    }
  }, [rendering, job?.status]);

  /**
   * 파일 선택창을 열기 전에 로그인부터 확인한다. 전에는 업로드하고 자막까지 다 손본
   * 뒤 서버가 401 을 주고서야 막혀서, 그때까지 한 작업이 통째로 날아갔다(원장님 실측).
   */
  function pickFiles() {
    if (!hasSession()) {
      setNeedsLogin(true);
      window.requestAnimationFrame(() => scrollIntoViewOnNarrow(loginNoticeRef.current));
      return;
    }
    setNeedsLogin(false);
    inputRef.current?.click();
  }

  function goToSignin() {
    router.push(`/user/signin?redirect=${encodeURIComponent(pathname)}`);
  }

  /**
   * 버튼 위로 끌어다 놓기. 시안에 안내 문구가 있었는데 정작 받는 쪽이 없어서 붙였다.
   * 로그인 확인은 파일 선택과 같은 자리에서 한 번 더 한다 — 드롭은 버튼을 거치지 않는다.
   */
  function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    if (busy || clips.length >= MAX_CLIPS) return;
    if (!hasSession()) {
      setNeedsLogin(true);
      window.requestAnimationFrame(() => scrollIntoViewOnNarrow(loginNoticeRef.current));
      return;
    }
    addFiles(event.dataTransfer.files);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const candidates = Array.from(files);
    const available = Math.max(0, MAX_CLIPS - clips.length);
    const accepted: File[] = [];
    const messages: string[] = [];
    const skippedByLimit: string[] = [];
    let totalLimitReported = false;
    let totalBytes = clips.reduce((sum, clip) => sum + clip.file.size, 0);

    for (const file of candidates) {
      if (!isAcceptedVideoFile(file)) {
        messages.push(`${file.name}: MP4, MOV, WEBM, MKV 형식만 지원합니다.`);
        continue;
      }
      if (accepted.length >= available) {
        // 앞에서부터 채우고 남는 것은 버린다. 전에는 "나머지 N개 제외" 라고 개수만
        // 알렸는데, 어느 파일이 빠졌는지 모르니 마지막에 고른 마무리 컷이 통째로
        // 빠진 것을 완성 영상을 보고서야 알았다(원장님 실측). 이름으로 알린다.
        skippedByLimit.push(file.name);
        continue;
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
      /*
        영상이 채워지는 순간 바로 만들지 않는다(8/27 원장님). 엔진은 영상을 보지
        않으므로, 유저가 무슨 시술인지 알려주기 전에 만들면 자막이 역할별 템플릿
        문구로 나온다 — AI 가 한 일이 없는 결과다. 재료를 받고 나서 만든다.

        "설정 없이도 결과가 나온다"(#180)는 그대로다. 주제를 비워도 버튼 한 번이면
        전과 같은 결과가 나오고, 채우면 첫 결과부터 자막이 그 내용을 탄다.
      */
    }
    if (skippedByLimit.length) {
      messages.push(
        `영상은 최대 ${MAX_CLIPS}개까지 사용해요. 고른 ${candidates.length}개 중 ${accepted.length}개만 담았습니다.`,
        `빠진 영상: ${skippedByLimit.join(", ")}`,
        "마무리 컷이 빠졌다면 필요 없는 클립을 지우고 다시 올려주세요.",
      );
    }
    setUploadIssue(
      messages.length
        ? {
            title: accepted.length
              ? "일부 영상은 빼고 담았어요"
              : "영상을 추가하지 못했어요",
            messages,
            tone: accepted.length ? "warning" : "error",
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
      setBlurFaces(true);
      setAudioMode("mute");
      setOrderEdited(false);
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

  /**
   * 주제로 자막을 만들어 붙인 클립 배열을 돌려준다. 실패하면 null 을 준다 —
   * 부르는 쪽이 원래 클립으로 계속 진행한다.
   */
  async function captionsForTopic(source: ClipDraft[]): Promise<ClipDraft[] | null> {
    setGeneratingCaptions(true);
    try {
      const response = await createVideoCaptions(
        source.map(({ role, description }, index) => ({
          index,
          role,
          description: description.trim() || undefined,
        })),
        captionPrompt,
      );
      return source.map((clip, index) => ({
        ...clip,
        caption: response.captions[index]?.caption ?? clip.caption,
      }));
    } catch {
      setError("자막을 만들지 못해 기본 문구로 만듭니다. 완성 뒤 자막을 고칠 수 있어요.");
      return null;
    } finally {
      setGeneratingCaptions(false);
    }
  }

  async function submitDraft(clipsToSubmit: ClipDraft[] = clips) {
    if (clipsToSubmit.length < MIN_CLIPS) {
      setError("시술 전후 흐름을 위해 영상을 2개 이상 올려주세요.");
      return;
    }
    /*
      주제를 받아 놓고 쓰지 않던 것을 고친다(8/27 원장님). 주제는 "AI로 자막 만들기"
      버튼에서만 쓰였고, 만들기는 클립의 caption 을 그대로 보냈다 — 그 값은 역할별
      템플릿 문구라(`ROLE_OPTIONS.caption`) 무엇을 적든 결과가 같았다.

      주제가 있으면 접수 전에 자막을 먼저 만들어 그 자막으로 접수한다. 실패해도
      접수는 계속한다 — 자막 때문에 영상 자체를 못 만들게 하지 않는다.
    */
    let clipsForJob = clipsToSubmit;
    if (captionPrompt) {
      const withCaptions = await captionsForTopic(clipsToSubmit);
      if (withCaptions) {
        clipsForJob = withCaptions;
        setClips(withCaptions);
      }
    }
    setSubmitting(true);
    setJob(null);
    setError("");
    // 지난 실행의 진행률·경과 시간이 첫 tick 전까지 남아 보이지 않게 여기서 비운다.
    setSmoothProgress(0);
    setElapsedSec(0);
    try {
      /*
        보내기 직전에 세션을 확인하고, 만료가 임박했으면 미리 갱신해 둔다.

        업로드는 스트림이라 요청 도중 토큰이 만료되면 프록시가 재시도할 수 없다(#192 논의).
        쿠키 유무만 보면 "아직 안 죽었지만 곧 죽을" 토큰으로 몇 분짜리 업로드를 시작하게 된다.
        서버 오류·통신 실패는 여기서 예외로 올라와 아래 catch 가 제 문구로 알린다.
      */
      if (!(await ensureFreshSession())) {
        setNeedsLogin(true);
        window.requestAnimationFrame(() =>
          scrollIntoViewOnNarrow(loginNoticeRef.current),
        );
        return;
      }
      const created = await createVideoJob(
        clipsForJob.map(
          ({ file, role, selection, caption, start_sec, end_sec, keep_audio }, index) => ({
            file,
            options: {
              role,
              selection,
              caption,
              ...(start_sec !== undefined && end_sec !== undefined
                ? { start_sec, end_sec }
                : {}),
              // 화면이 "고른 순서대로 이어 붙인다"고 말하므로 순서를 손대지 않았어도
              // 항상 보낸다. 안 보내면 서버가 role 로 정렬하는데(`ROLE_ORDER`), 기본
              // 배정이 5개부터 [전·과정·디테일·과정·마무리]가 되어 3번과 4번이 뒤바뀐다
              // — 화면 순서와 결과가 달라진다(#193 리뷰).
              clip_order: index,
              ...(audioMode === "original"
                ? { keep_audio: keep_audio !== false }
                : {}),
            },
          }),
        ),
        blurFaces,
        audioMode,
      );
      setEditingResult(false);
      setJob(await getVideoJob(created.job_id));
    } catch (submitError) {
      setError(errorMessage(submitError, "영상 작업을 접수하지 못했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

  async function generateCaptions() {
    if (clips.length < MIN_CLIPS) {
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
        captionPrompt,
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
    setMood("");
    setEditingResult(false);
    setBlurFaces(true);
    setAudioMode("mute");
    setActiveClipId(null);
    setOrderEdited(false);
    setError("");
    setUploadIssue(null);
    setPhoneStep(1);
  }

  function editResult() {
    setEditingResult(true);
    setPhoneStep(2);
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      editor.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }

  function swapBoundaryClips() {
    if (busy || clips.length < 2) return;
    const nextClips = [...clips];
    const lastIndex = nextClips.length - 1;
    [nextClips[0], nextClips[lastIndex]] = [nextClips[lastIndex], nextClips[0]];
    setClips(nextClips);
    setOrderEdited(true);
  }

  const busy = rendering || generatingCaptions;

  const activeClip = clips.find((clip) => clip.id === activeClipId) ?? clips[0] ?? null;
  const activeClipIndex = activeClip
    ? clips.findIndex((clip) => clip.id === activeClip.id)
    : -1;
  const summaryClips =
    clips.length <= 2 ? clips : [clips[0], clips[clips.length - 1]];
  const expectedSeconds = clips.reduce(
    (sum, clip) =>
      sum +
      (clip.start_sec !== undefined && clip.end_sec !== undefined
        ? clip.end_sec - clip.start_sec
        : DEFAULT_CLIP_SECONDS),
    0,
  );
  const expectedSecondsLabel = expectedSeconds.toFixed(1).replace(/\.0$/, "");
  // 서버가 전체 30초를 넘기면 422 로 떨군다. 만들기를 누르고 기다린 뒤 실패를 보는
  // 것보다, 누르기 전에 막고 무엇을 줄이면 되는지 알려주는 편이 낫다.
  const overLength =
    expectedSeconds - MAX_TOTAL_SECONDS > DURATION_EPSILON_SECONDS;
  const stage = progressStage(serverProgress, blurFaces);
  const hasResult = job?.status === "completed";
  /*
    폰에서 실제로 보여줄 단계. job 이 움직이면 그쪽이 이긴다 — 만드는 중에는 진행
    표시가 있는 2단계, 다 되면 결과가 있는 3단계다. 그 밖에는 유저가 고른 단계를
    쓴다. effect 에서 setState 하지 않으려고 파생값으로 둔다(lint 가 막는다).
  */
  const shownStep: 1 | 2 | 3 = hasResult && !editingResult
    ? 3
    : job?.status === "queued" || job?.status === "processing"
      ? 2
      : phoneStep;

  // 만들기 CTA는 2단계 하단에만 둔다. 폰에서는 StepNav가 같은 버튼을 고정한다.
  const generateCta = (
    <Button
      onClick={() => submitDraft()}
      disabled={busy || clips.length < MIN_CLIPS || overLength}
      className="min-h-11 w-full transition-[filter] hover:brightness-90 active:brightness-95"
      style={{ backgroundColor: IDENTITY_INK, color: "#FFFFFF" }}
    >
      {busy ? <LoaderCircle className="animate-spin" /> : <Film />}
      {busy ? "AI가 만드는 중" : "AI가 자동으로 만들어주기"}
    </Button>
  );

  /* 카드가 전부 보이므로 단계는 "지금 어디까지 왔는지" 표시일 뿐이다. */
  const currentStep: 1 | 2 | 3 =
    job?.status === "completed" && !editingResult ? 3 : clips.length >= MIN_CLIPS ? 2 : 1;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-28 sm:px-6 lg:py-12 lg:pb-12">
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
          {(!hasResult || editingResult) && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              찍어둔 클립만 고르면 9:16 릴스로 자동 편집돼요.
            </p>
          )}
        </div>
      </div>

      {/* 다 만든 뒤에는 단계 표시를 걷는다(8/27 원장님). 어디까지 왔는지는 만드는
          동안 쓸모 있는 정보이고, 완성 화면에서는 결과가 먼저 보여야 한다. */}
      {(!hasResult || editingResult) && <ShortsSteps current={currentStep} />}

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

      {/*
        전체 길이 초과. 만들기 버튼이 잠기는 이유라서 어느 단계에서나 보이도록
        게이트 밖에 둔다 — 구간을 줄이는 곳(직접 손보기)과 클립을 빼는 곳(업로드)이
        서로 다른 카드에 있어서, 한쪽에만 두면 다른 쪽에서 이유를 알 수 없다.
      */}
      {overLength && (
        <Alert variant="destructive" className="mt-4">
          <Info />
          <AlertTitle>전체 길이가 {MAX_TOTAL_SECONDS}초를 넘었어요</AlertTitle>
          <AlertDescription>
            지금 예상 {expectedSecondsLabel}초입니다. 직접 손보기에서 구간을 줄이거나
            클립을 빼면 만들 수 있어요.
          </AlertDescription>
        </Alert>
      )}

      {/*
        로그인 안내. 업로드를 누른 자리(1단계)에 두면 폰에서 결과 단계로 넘어갔을 때
        가려지므로 오류 안내와 같은 자리에 둔다.
      */}
      {needsLogin && (
        <div ref={loginNoticeRef}>
          <Alert className="mt-4 border-primary/30 bg-primary/5">
            <LogIn className="text-primary" />
            <AlertTitle>로그인 후 이용할 수 있어요</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                영상을 올리기 전에 로그인해주세요. 다 만들고 나서 막히지 않도록 미리
                확인합니다. 로그인하면 이 화면으로 돌아와요.
              </p>
              <Button type="button" size="sm" onClick={goToSignin}>
                <LogIn />로그인하러 가기
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/*
        업로드에서 뺀 파일 안내도 같은 이유로 단계 게이트 밖에 둔다. 전에는 업로드
        카드(1단계) 안에 있었는데, 영상 2개가 채워지는 순간 초안 생성이 시작되면서
        화면이 결과(3단계)로 넘어가 버려 안내가 함께 사라졌다 — 10개를 골랐는데 8개만
        들어간 것을 완성 영상에서야 알게 된 원인이다(원장님 실측).
      */}
      {uploadIssue && (
        <Alert
          variant={uploadIssue.tone === "error" ? "destructive" : "default"}
          className={`mt-4 min-w-0 ${
            uploadIssue.tone === "warning" ? "border-amber-300 bg-amber-50/60" : ""
          }`}
        >
          <Info className={uploadIssue.tone === "warning" ? "text-amber-600" : undefined} />
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

      {/*
        완성 뒤에는 결과를 맨 위로 올린다(8/27 원장님). 고칠 대상이 눈앞에 있어야
        "이 영상을 고치는 중" 이 읽힌다 — 결과가 맨 아래면 조정하면서 볼 수가 없다.
        DOM 을 옮기지 않고 order 로만 바꾼다. resultRef·editorRef 로 스크롤을 옮기는
        곳이 있어 순서를 코드에서 바꾸면 그쪽이 같이 흔들린다.
      */}
      <div className="mt-6 flex flex-col gap-6">
          <Card className={stepVisibility(1, shownStep)}>
            {/* 폰에서는 위 단계 표시가 같은 말을 하고 있다 — lg 에서만 제목을 둔다. */}
            <CardHeader className="hidden lg:grid">
              <CardTitle>시술 영상 고르기</CardTitle>
            </CardHeader>
            <CardContent>
              {/*
                영상을 담기 전에는 이 자리가 주인공이지만, 담고 나면 담긴 목록이
                주인공이어야 한다. 올린 뒤에도 큰 "영상 선택하기" 가 그대로 있으면
                안 올라간 줄 알게 된다(원장님 실측) — 담기고 나면 목록 아래 작은
                "영상 더 넣기" 로 물러난다.
              */}
              {clips.length === 0 && (
                <button
                  type="button"
                  onClick={pickFiles}
                  disabled={busy}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!busy) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-10 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    dragging
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/30 hover:bg-muted/60"
                  }`}
                >
                  <Upload className="mb-3 h-8 w-8 text-primary" />
                  <span className="font-medium">영상 선택하기</span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {MIN_CLIPS}~{MAX_CLIPS}개 · MP4, MOV, WEBM, MKV · 파일당 160MB
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {dragging ? "여기에 놓으세요" : "여기로 끌어다 놓아도 돼요"}
                  </span>
                </button>
              )}

              {clips.length === 0 && (
                <div className="mt-6">
                  <p className="text-sm font-medium">이런 영상 2개~8개까지 가능해요</p>
                  <ul className="mt-3 grid max-w-[400px] grid-cols-3 gap-2 sm:gap-3">
                    {EXAMPLE_SHOTS.map((shot) => (
                      <li key={shot.label} className="min-w-0">
                        {/* 정적 파일이라 최적화 대상이 아니다 — 랜딩도 같은 방식으로 쓴다. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shot.src}
                          alt=""
                          loading="lazy"
                          className="aspect-[9/16] w-full rounded-xl border object-cover"
                        />
                        <p className="mt-2 truncate text-center text-xs font-medium">
                          {shot.label}
                        </p>
                        <p className="truncate text-center text-[11px] text-muted-foreground">
                          {shot.hint}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
              {/*
                담긴 클립과 그 순서를 업로드 자리에서 바로 보여준다. 순서 조절은 세부
                조정 카드 안에도 있지만, 접힌 카드를 열고 클립 탭을 골라야 나와서
                "순서를 바꿀 수 있다"는 것 자체를 알기 어려웠다(원장님 실측 6번).
              */}
              {clips.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className={`text-xs font-medium ${overLength ? "text-destructive" : ""}`}>
                      클립 {clips.length}/{MAX_CLIPS}개 · 예상 {expectedSecondsLabel}초
                      {overLength ? ` / 최대 ${MAX_TOTAL_SECONDS}초` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">고른 순서대로 이어 붙여요</p>
                  </div>
                  <ol className="space-y-1">
                    {clips.map((clip, index) => (
                      <li
                        key={clip.id}
                        className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs">{clip.file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={busy || index === 0}
                          onClick={() => moveClip(index, -1)}
                          aria-label={`${clip.file.name} 앞으로 이동`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={busy || index === clips.length - 1}
                          onClick={() => moveClip(index, 1)}
                          aria-label={`${clip.file.name} 뒤로 이동`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={busy}
                          onClick={() => removeClip(clip.id)}
                          aria-label={`${clip.file.name} 제거`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs leading-5 text-muted-foreground">
                    한 컷은 기본 {DEFAULT_CLIP_SECONDS}초예요. 직접 손보기에서
                    {MIN_RANGE_SECONDS}~{MAX_RANGE_SECONDS}초까지 바꿀 수 있고, 전체는
                    최대 {MAX_TOTAL_SECONDS}초까지 만들어져요.
                  </p>
                  {clips.length < MAX_CLIPS ? (
                    <button
                      type="button"
                      onClick={pickFiles}
                      disabled={busy}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!busy) setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        dragging
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/60"
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                      {dragging ? "여기에 놓으세요" : `영상 더 넣기 (${MAX_CLIPS - clips.length}개 더)`}
                    </button>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">
                      {MAX_CLIPS}개를 모두 채웠어요. 바꾸려면 위에서 필요 없는 클립을 지워주세요.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div ref={editorRef} className={stepVisibility(2, shownStep)}>
            <Card>
              <CardHeader>
                <CardTitle>어떤 릴스로 만들까요?</CardTitle>
                <CardDescription className="mt-2 leading-6">
                  원하는 느낌을 한 문장으로 적고, 기본 설정만 확인하면 AI가 자동으로 만듭니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="caption-topic">시술과 원하는 연출을 적어주세요</Label>
                  <Input
                    id="caption-topic"
                    value={topic}
                    maxLength={MAX_CAPTION_CONTEXT_LENGTH}
                    disabled={busy}
                    placeholder="레이어드컷 전후를 자연스럽고 고급스럽게 보여주세요"
                    onChange={(event) => setTopic(event.target.value)}
                    className="min-h-11"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    비워두면 선택한 영상 순서와 기본 자막으로 만듭니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">분위기</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="릴스 분위기">
                    {MOOD_OPTIONS.map((option) => {
                      const selected = mood === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={selected}
                          disabled={busy}
                          onClick={() => setMood(selected ? "" : option)}
                          className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
                            selected
                              ? "border-transparent text-white"
                              : "border-border bg-background hover:bg-muted"
                          }`}
                          style={selected ? { backgroundColor: IDENTITY_INK } : undefined}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">선택한 영상</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      disabled={busy || clips.length < 2}
                      onClick={swapBoundaryClips}
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      {clips.length > 2 ? "처음·마지막 바꾸기" : "순서 바꾸기"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {summaryClips.map((clip, index) => {
                      const roleLabel = simpleRoleLabel(clip.role);
                      const positionLabel =
                        clips.length > 2 ? (index === 0 ? "처음" : "마지막") : roleLabel;
                      return (
                        <div key={clip.id} className="overflow-hidden rounded-xl border bg-muted/20">
                          <ClipThumbnail file={clip.file} label={positionLabel} />
                          <div className="p-3">
                            <p className="text-sm font-medium">{positionLabel}</p>
                            {clips.length > 2 && (
                              <p className="mt-1 text-xs text-muted-foreground">{roleLabel}</p>
                            )}
                            <p className="mt-1 truncate text-xs text-muted-foreground">{clip.file.name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {clips.length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      중간 영상 {clips.length - 2}개와 전체 순서는 세부 설정에서 바꿀 수 있어요.
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex min-h-11 items-center justify-between gap-4">
                      <Label htmlFor="blur-faces">얼굴 가리기</Label>
                      <Switch
                        id="blur-faces"
                        checked={blurFaces}
                        disabled={busy}
                        onCheckedChange={setBlurFaces}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {blurFaces
                        ? "면적이 가장 큰 한 명의 얼굴을 가려요."
                        : "모든 출연자의 촬영·게시 동의를 확인해주세요."}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex min-h-11 items-center justify-between gap-4">
                      <Label htmlFor="original-audio">원본 소리</Label>
                      <Switch
                        id="original-audio"
                        checked={audioMode === "original"}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          setAudioMode(checked ? "original" : "mute")
                        }
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      끄면 모든 클립을 무음으로 만듭니다.
                    </p>
                  </div>
                </div>

                <details className="group overflow-hidden rounded-xl border bg-muted/10">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:hidden">
                    <span className="min-w-0">
                      <span className="block">직접 손보기</span>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        자막과 컷 구간을 직접 수정할 수 있어요
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="space-y-4 border-t p-4">
                    <div className="rounded-xl border bg-background p-4">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11 w-full"
                        onClick={generateCaptions}
                        disabled={busy || clips.length < MIN_CLIPS}
                      >
                        {generatingCaptions ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Sparkles />
                        )}
                        {generatingCaptions ? "AI 자막 만드는 중" : "AI 자막만 다시 만들기"}
                      </Button>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                        <li>영상·대표 프레임·사용 구간은 AI 자막 요청에 전송되지 않습니다.</li>
                        <li>각 컷을 누르면 자막과 사용 구간을 직접 바꿀 수 있어요.</li>
                      </ul>
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-background">
                      {clips.map((clip, index) => (
                        <button
                          key={clip.id}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setActiveClipId(clip.id);
                            setEditorOpen(true);
                          }}
                          className="flex min-h-11 w-full items-center gap-3 border-b px-3 py-3 text-left last:border-b-0 hover:bg-muted/40 disabled:opacity-60"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {ROLE_OPTIONS.find((option) => option.value === clip.role)?.label ?? clip.role}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {clip.file.name}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {clip.caption ? "자막 있음" : "자막 없음"}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                </details>

                <div className="hidden lg:block">{generateCta}</div>
              </CardContent>
              {(submitting || (busy && job)) && (
                <CardContent>
                  <div className="py-6 text-center">
                    <LoaderCircle className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                    <p className="font-medium">{stage.title}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {stage.hint && (
                        <>
                          {stage.hint}
                          <br />
                        </>
                      )}
                      브라우저를 닫지 말고 잠시 기다려주세요.
                    </p>
                    <div
                      className="mx-auto mt-6 h-2 max-w-[420px] overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(smoothProgress)}
                      aria-label="영상 만드는 중"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-linear"
                        style={{ width: `${Math.max(4, smoothProgress)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      약 {Math.round(smoothProgress)}%
                    </p>
                    {elapsedSec > LONG_RUNNING_SECONDS && (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        조금만 더 기다려 주세요. 영상이 길수록 더 걸려요.
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

        <section ref={resultRef} className={stepVisibility(3, shownStep)}>
          <Card>
            <CardHeader>
              <CardTitle>릴스가 완성됐어요</CardTitle>
              <CardDescription>
                세로형 {audioMode === "original" ? "원음 포함" : "무음"} MP4로 생성됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {job?.status === "completed" ? (
                <div className="mx-auto w-full max-w-[420px] space-y-4">
                  <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl bg-black">
                    {/*
                      `#t=0.1` 로 첫 프레임을 미리 그린다. 그냥 두면 완성된 영상인데도
                      까만 화면에 재생 버튼만 떠서 실패한 것처럼 보였다(원장님 실측 4번).
                      Range 요청을 못 받는 환경을 대비해 onLoadedMetadata 에서도 한 번 더
                      맞춘다 — 서버가 대표 프레임을 내려주면 poster 로 바꾸는 편이 낫다.
                    */}
                    <video
                      className="aspect-[9/16] w-full"
                      controls
                      playsInline
                      preload="metadata"
                      src={`${videoJobUrl(job.job_id)}#t=0.1`}
                      onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        if (video.currentTime === 0 && video.duration > 0.2) {
                          video.currentTime = 0.1;
                        }
                      }}
                    />
                  </div>
                  {/*
                    길이·처리 시간·블러 횟수 같은 수치 상자를 걷었다(8/27 원장님).
                    영상이 눈앞에 있는데 "생성 완료" 를 글로 다시 말할 이유가 없고,
                    나머지는 유저가 궁금해하는 값이 아니다. 블러 한계는 스위치 옆에서
                    이미 말한다. 보관 기한만 저장을 미루지 않도록 남긴다.
                  */}
                  <div className="grid gap-2 sm:grid-cols-3">
                    <a
                      href={videoJobUrl(job.job_id)}
                      download="saloncutai-shorts.mp4"
                      className={buttonVariants({ className: "min-h-11 w-full" })}
                    >
                      <Download />이대로 저장
                    </a>
                    <Button
                      variant="outline"
                      className="min-h-11 w-full"
                      disabled={busy}
                      onClick={editResult}
                    >
                      조금 수정하기
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-11 w-full"
                      disabled={busy}
                      onClick={reset}
                    >
                      새 영상 만들기
                    </Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    원본과 결과는 24시간 후 삭제돼요.
                  </p>
                </div>
              ) : (
                <div className="mx-auto max-w-[420px] space-y-3 py-4 text-center">
                  <div className="relative mx-auto aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-2xl border bg-gradient-to-b from-muted to-muted-foreground/25">
                    <span className="absolute inset-0 m-auto flex h-10 w-10 items-center justify-center rounded-full bg-background/90 shadow">
                      <Play className="ml-0.5 h-4 w-4" />
                    </span>
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">
                      9:16 · {audioMode === "original" ? "원음 포함" : "무음"}
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    완성되면 여기에 나와요. 저장한 뒤 인스타 릴스나 스토리에 그대로
                    올리시면 됩니다.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>


      {/*
        컷 편집은 드로어에서 한다(8/27 원장님). 항목은 그대로 두고 자리만 옮겼다 —
        필름 스트립처럼 자리를 많이 먹는 것을 늘 펼쳐 둘 이유가 없었고, 목록과 편집이
        한 화면에 이어져 있어 무엇을 고치는 중인지 흐렸다. 제목이 몇 번 컷인지 말한다.
      */}
      <Drawer open={editorOpen} onOpenChange={setEditorOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>
              {activeClip ? `${activeClipIndex + 1}번 컷` : "컷 편집"}
            </DrawerTitle>
            <DrawerDescription className="truncate">
              {activeClip?.file.name}
            </DrawerDescription>
          </DrawerHeader>
          {activeClip && (
            <>
            <div className="overflow-y-auto px-4 pb-4">
        {/* 드로어 제목이 몇 번 컷인지·파일명을 이미 말하므로 여기서는 되풀이하지 않는다. */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {(activeClip.file.size / MIB).toFixed(1)}MB
            {orderEdited ? " · 순서 직접 조정됨" : ""}
          </p>
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
        <details className="group mt-4 overflow-hidden rounded-xl border bg-muted/10">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:hidden">
            정밀하게 자르기
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
          </summary>
          <div className="space-y-4 border-t p-4">
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
            {audioMode === "original" && (
              <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
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
            <div className="space-y-2">
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
          </div>
        </details>
            </div>
            <DrawerFooter className="border-t pt-4">
              <Button
                type="button"
                className="min-h-11 w-full"
                disabled={busy}
                onClick={() => setEditorOpen(false)}
              >
                수정 적용하고 닫기
              </Button>
            </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/*
        폰에서는 한 번에 한 단계만 보여준다(8/27 원장님). 세로로 다 펴 놓으니 자동
        편집 카드가 스크롤을 내려야 보였다 — 앱처럼 넘어가는 편이 낫다.
        얼굴 교체·블로그가 쓰는 StepNav 를 그대로 쓴다. lg 이상은 카드가 전부
        보이므로 이 바도, 단계 전환도 걸리지 않는다.
      */}
      {shownStep <= 2 && (
        <StepNav
          step={shownStep}
          totalSteps={2}
          canGoNext={clips.length >= MIN_CLIPS && !overLength}
          nextHint={
            clips.length < MIN_CLIPS
              ? `영상을 ${MIN_CLIPS - clips.length}개 더 올려주세요.`
              : overLength
                ? "전체 길이가 30초를 넘어요. 구간을 줄여주세요."
                : undefined
          }
          onPrev={() => setPhoneStep(1)}
          onNext={() => setPhoneStep(2)}
          cta={generateCta}
          width="max-w-3xl"
        />
      )}
    </div>
  );
}
