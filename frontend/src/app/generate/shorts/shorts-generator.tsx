"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Captions,
  CheckCircle2,
  Download,
  Film,
  Info,
  LoaderCircle,
  LogIn,
  Play,
  Plus,
  ShieldCheck,
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
type UploadIssue = { title: string; messages: string[]; tone: "warning" | "error" };
const MIB = 1024 * 1024;
const MAX_FILE_BYTES = 160 * MIB;
const MAX_TOTAL_BYTES = 320 * MIB;
const MAX_CAPTION_CONTEXT_LENGTH = 100;
/** 서버(`video_gen/engine.py` 의 MIN_CLIPS·MAX_CLIPS)와 같은 값. 개수가 화면 곳곳에
 * 흩어져 있었는데, 8 을 하나 고치면 나머지도 같이 고쳐야 해서 상수로 모았다. */
const MIN_CLIPS = 2;
const MAX_CLIPS = 8;
/** 완성 영상 전체 길이 상한. 클립당 5초와 함께 서버가 받는 값이다(승원님 확정). */
const MAX_TOTAL_SECONDS = 30;
/**
 * 총합을 견줄 때 허용하는 오차. 서버의 `DURATION_EPSILON_SECONDS` 와 같은 값이다.
 *
 * 0.1 초 단위를 더하면 수학적으로 30 인 조합이 `30.000000000000004` 가 되는데, 서버는
 * 이 허용치로 받아주므로 화면만 막으면 만들 수 있는 영상을 못 만들게 된다(#193 리뷰).
 */
const DURATION_EPSILON_SECONDS = 1e-6;
/** 구간을 직접 고르지 않은 클립이 차지하는 길이(서버 `CLIP_SECONDS`). */
const DEFAULT_CLIP_SECONDS = 2;

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

/**
 * 진행 중 안내 문구.
 *
 * 구간은 서버가 흘리는 progress 마일스톤에 맞춘다(backend PR #190) — 클립 분석 0~40,
 * 자막 준비 45, 얼굴 블러 마스크 45~75, 인코딩 직전 80, 인코딩 완료 95, 정리 100.
 * 그전에는 서버가 40 에서 95 로 바로 뛰어 화면이 "40% 에서 멈춘 것"처럼 보였다.
 *
 * `ceiling` 은 아래 useEffect 의 추정 진행률이 넘지 못할 한계다 — 다음 마일스톤을
 * 앞질러 놓고 기다리는 일이 없어야 한다.
 */
type ProgressStage = {
  from: number;
  ceiling: number;
  title: string;
  hint: string;
  /** 얼굴 블러를 끈 경우의 문구. 서버는 블러가 꺼져 있어도 같은 구간을 지나가므로
   * (PR #190), 하지도 않은 일을 화면이 말하지 않도록 갈라 쓴다. */
  titleWithoutBlur?: string;
  hintWithoutBlur?: string;
};

const PROGRESS_STAGES: ProgressStage[] = [
  {
    from: 0,
    ceiling: 15,
    title: "영상을 올리고 있어요",
    hint: "파일이 클수록 조금 더 걸려요.",
  },
  {
    from: 1,
    ceiling: 39,
    title: "클립을 하나씩 다듬고 있어요",
    hint: "고른 구간을 잘라내는 중이에요.",
  },
  {
    from: 40,
    ceiling: 44,
    title: "자막을 얹고 있어요",
    hint: "골라주신 문구를 화면에 앉히는 중이에요.",
  },
  {
    from: 45,
    ceiling: 79,
    title: "얼굴을 찾아 흐리게 처리하고 있어요",
    hint: "사람이 여럿 나오면 조금 더 걸려요.",
    titleWithoutBlur: "장면을 하나씩 준비하고 있어요",
    hintWithoutBlur: "얼굴 블러를 꺼두셔서 이 단계는 금방 지나가요.",
  },
  {
    from: 80,
    ceiling: 94,
    title: "컷을 이어 붙이고 있어요",
    hint: "이 단계가 가장 오래 걸려요. 그대로 두셔도 됩니다.",
  },
  {
    from: 95,
    ceiling: 99,
    title: "마지막으로 다듬고 있어요",
    hint: "곧 완성돼요.",
  },
];

function progressStage(progress: number, blurFaces = true) {
  const stage =
    [...PROGRESS_STAGES].reverse().find((item) => progress >= item.from) ??
    PROGRESS_STAGES[0];
  return {
    ceiling: stage.ceiling,
    title: (!blurFaces && stage.titleWithoutBlur) || stage.title,
    hint: !blurFaces && stage.hintWithoutBlur !== undefined
      ? stage.hintWithoutBlur
      : stage.hint,
  };
}

/**
 * 이 시간을 넘기면 "조금 더 걸린다"고만 알린다.
 *
 * 흐르는 초를 숫자로 보여주지는 않는다 — 기다리는 쪽이 초조해져서 얼굴 교체·블로그
 * 화면에서 이미 걷어낸 표시다(8/25 원장님, `face-swap-waiting.tsx` 참고). 경과 시간은
 * 이 판정에만 쓴다.
 */
const LONG_RUNNING_SECONDS = 120;

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
  const [needsLogin, setNeedsLogin] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  // 서버 progress 위에 얹는 추정 진행률과 경과 시간. 바가 멈춰 보이지 않게 하는 용도라
  // 실제 작업량이 아니라 시간으로만 움직인다 — 그래서 화면에도 "약" 을 붙여 적는다.
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const loginNoticeRef = useRef<HTMLDivElement>(null);
  /* 자동 초안을 이미 만들었는지. 버튼 라벨이 이 값을 읽어야 해서 ref 가 아니라
     state 로 둔다 — 렌더 중 ref 를 읽으면 값이 바뀌어도 다시 그리지 않는다. */
  const [autoDrafted, setAutoDrafted] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  // 폰 단계식(A안, Discussion #149 — 얼굴 교체·블로그와 같은 흐름)에서 지금 보여줄 단계.
  // 1~2 는 입력, 3 은 결과. lg 이상에서는 쓰이지 않는다 — 카드가 전부 렌더된다.
  const [phoneStep, setPhoneStep] = useState(1);
  const rendering =
    submitting || job?.status === "queued" || job?.status === "processing";
  const serverProgress = job?.progress ?? 0;
  const serverProgressRef = useRef(0);

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
      if (
        clips.length < MIN_CLIPS &&
        nextClips.length >= MIN_CLIPS &&
        !autoDrafted
      ) {
        setAutoDrafted(true);
        void submitDraft(nextClips);
      }
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
      setAutoDrafted(false);
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
    if (clipsToSubmit.length < MIN_CLIPS) {
      setError("시술 전후 흐름을 위해 영상을 2개 이상 올려주세요.");
      return;
    }
    setSubmitting(true);
    /*
      보내기 직전에 세션을 확인하고, 만료가 임박했으면 미리 갱신해 둔다.

      업로드는 스트림이라 요청 도중 토큰이 만료되면 프록시가 재시도할 수 없다(#192 논의).
      쿠키 유무만 보면 "아직 안 죽었지만 곧 죽을" 토큰으로 몇 분짜리 업로드를 시작하게 된다.
    */
    if (!(await ensureFreshSession())) {
      setSubmitting(false);
      setNeedsLogin(true);
      window.requestAnimationFrame(() => scrollIntoViewOnNarrow(loginNoticeRef.current));
      return;
    }
    setJob(null);
    setError("");
    // 지난 실행의 진행률·경과 시간이 첫 tick 전까지 남아 보이지 않게 여기서 비운다.
    setSmoothProgress(0);
    setElapsedSec(0);
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
      setJob(await getVideoJob(created.job_id));
    } catch (submitError) {
      setError(errorMessage(submitError, "영상 작업을 접수하지 못했습니다."));
      openDetails();
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
    setAutoDrafted(false);
    setError("");
    setUploadIssue(null);
    setPhoneStep(1);
  }

  const busy = rendering || generatingCaptions;

  const activeClip = clips.find((clip) => clip.id === activeClipId) ?? clips[0] ?? null;
  const activeClipIndex = activeClip
    ? clips.findIndex((clip) => clip.id === activeClip.id)
    : -1;
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

  // 만들기 버튼 하나를 두 자리에서 그린다 — 데스크톱은 제목 옆, 폰은 하단 고정 바.
  const generateCta = (
    <Button
      onClick={() => submitDraft()}
      disabled={busy || clips.length < MIN_CLIPS || overLength}
      className="w-full transition-[filter] hover:brightness-90 active:brightness-95"
      style={{ backgroundColor: IDENTITY_INK }}
    >
      {busy ? <LoaderCircle className="animate-spin" /> : <Film />}
      {job || autoDrafted ? "변경사항으로 다시 만들기" : "숏츠 만들기"}
    </Button>
  );

  const stepReady: Record<number, boolean> = {
    1: clips.length >= MIN_CLIPS,
    2: clips.length >= MIN_CLIPS,
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

      {/*
        전체 길이 초과. 만들기 버튼이 잠기는 이유라서 어느 단계에서나 보이도록
        게이트 밖에 둔다 — 구간을 줄이는 곳(세부 조정)과 클립을 빼는 곳(업로드)이
        서로 다른 카드에 있어서, 한쪽에만 두면 다른 쪽에서 이유를 알 수 없다.
      */}
      {overLength && (
        <Alert variant="destructive" className="mt-4">
          <Info />
          <AlertTitle>전체 길이가 {MAX_TOTAL_SECONDS}초를 넘었어요</AlertTitle>
          <AlertDescription>
            지금 예상 {expectedSecondsLabel}초입니다. 세부 조정에서 구간을 줄이거나
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
                onClick={pickFiles}
                disabled={busy || clips.length >= MAX_CLIPS}
                className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="mb-3 h-8 w-8 text-primary" />
                <span className="font-medium">영상 선택하기</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {clips.length >= MAX_CLIPS
                    ? `${MAX_CLIPS}개를 모두 채웠어요`
                    : `${MIN_CLIPS}~${MAX_CLIPS}개 · 파일당 160MB`}
                </span>
              </button>
              {clips.length >= MAX_CLIPS && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  더 넣으려면 아래 목록에서 필요 없는 클립을 지워주세요.
                </p>
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
                    한 컷은 기본 {DEFAULT_CLIP_SECONDS}초예요. 세부 조정에서
                    {MIN_RANGE_SECONDS}~{MAX_RANGE_SECONDS}초까지 바꿀 수 있고, 전체는
                    최대 {MAX_TOTAL_SECONDS}초까지 만들어져요.
                  </p>
                </div>
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
                        disabled={busy || clips.length < MIN_CLIPS}
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
                  {clips.length < MAX_CLIPS && (
                    <Button type="button" variant="outline" onClick={pickFiles} disabled={busy}>
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
                    className="mt-6 h-2 overflow-hidden rounded-full bg-muted"
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
                    영상을 {MIN_CLIPS}개 이상 올리면 고른 순서 그대로 초안을 만들어요.
                    순서·자막을 바꿔 몇 번이든 다시 만들 수 있어요.
                  </p>
                </div>
              )}
              {clips.length >= MIN_CLIPS && (
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
