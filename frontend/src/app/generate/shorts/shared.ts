import type {
  VideoClipOptions,
  VideoRole,
  VideoSelection,
} from "@/lib/api-client/types";

/*
  숏폼 화면이 공유하는 타입·상수·순수 함수.

  화면을 카드 세 장(고르기 / 자동 편집 / 저장)으로 쪼개면서, 세 컴포넌트가 같이 쓰는
  것들을 여기로 모았다. JSX 도 훅도 없는 것만 둔다 — 테스트를 붙이려면 이쪽부터다.
*/

export type DescriptionMode = "preset" | "custom";
export type ClipDraft = VideoClipOptions & {
  id: string;
  file: File;
  description: string;
  descriptionMode: DescriptionMode;
};
export type ClipDraftChanges = Partial<VideoClipOptions> & {
  description?: string;
  descriptionMode?: DescriptionMode;
};
export type UploadIssue = { title: string; messages: string[]; tone: "warning" | "error" };
export const MIB = 1024 * 1024;
export const MAX_FILE_BYTES = 160 * MIB;
export const MAX_TOTAL_BYTES = 320 * MIB;
export const MAX_CAPTION_CONTEXT_LENGTH = 100;
/** 서버(`video_gen/engine.py` 의 MIN_CLIPS·MAX_CLIPS)와 같은 값. 개수가 화면 곳곳에
 * 흩어져 있었는데, 8 을 하나 고치면 나머지도 같이 고쳐야 해서 상수로 모았다. */
export const MIN_CLIPS = 2;
export const MAX_CLIPS = 8;
/** 완성 영상 전체 길이 상한. 클립당 5초와 함께 서버가 받는 값이다(승원님 확정). */
export const MAX_TOTAL_SECONDS = 30;
/**
 * 총합을 견줄 때 허용하는 오차. 서버의 `DURATION_EPSILON_SECONDS` 와 같은 값이다.
 *
 * 0.1 초 단위를 더하면 수학적으로 30 인 조합이 `30.000000000000004` 가 되는데, 서버는
 * 이 허용치로 받아주므로 화면만 막으면 만들 수 있는 영상을 못 만들게 된다(#193 리뷰).
 */
export const DURATION_EPSILON_SECONDS = 1e-6;
/** 구간을 직접 고르지 않은 클립이 차지하는 길이(서버 `CLIP_SECONDS`). */
export const DEFAULT_CLIP_SECONDS = 2;

export const CUSTOM_DESCRIPTION_VALUE = "__custom__";
export const ACCEPTED_VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv"]);

/**
 * 목적지 색(Discussion #149 3번) — 인스타 릴스. 얼굴 교체와 목적지가 같아(둘 다
 * 인스타) 그라디언트 양 끝을 나눠 쓴다 — 숏폼은 주황·노랑 끝. 흰 글자 5.18:1,
 * wash 위 4.60:1 — 둘 다 WCAG AA 통과.
 */
export const IDENTITY_INK = "#C2410C";
export const IDENTITY_WASH = "#fdefe4";

/**
 * 서버가 받는 기준과 같게 판정한다 — backend `video_jobs.py` 의
 * `ALLOWED_SUFFIXES` 도 MIME 이 아니라 확장자를 본다.
 *
 * 전에는 `file.type.startsWith("video/")` 를 OR 로 함께 봤는데, accept 를
 * `video/*` 로 넓히자 AVI 처럼 서버가 안 받는 형식까지 화면에서는 통과해
 * 업로드 단계에서야 415 로 떨어졌다. 고르는 자리에서 바로 알려주는 편이 낫다.
 */
export function isAcceptedVideoFile(file: File): boolean {
  const extension = file.name.includes(".")
    ? `.${file.name.split(".").pop()?.toLowerCase()}`
    : "";
  return ACCEPTED_VIDEO_EXTENSIONS.has(extension);
}

export function fileSizeLabel(bytes: number): string {
  return `${(bytes / MIB).toFixed(1)}MB`;
}

export function createClipId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const ROLE_OPTIONS: { value: VideoRole; label: string; caption: string }[] = [
  { value: "before", label: "시술 전", caption: "시술 전, 오늘의 변화를 시작합니다" },
  { value: "process", label: "시술 과정", caption: "섬세하게 완성해 가는 시술 과정" },
  { value: "detail", label: "디테일", caption: "작은 디테일까지 꼼꼼하게" },
  { value: "after", label: "마무리", caption: "완성된 스타일을 확인해 보세요" },
];

export const SELECTION_OPTIONS: { value: VideoSelection; label: string }[] = [
  { value: "start", label: "앞 2초" },
  { value: "center", label: "가운데 2초" },
  { value: "end", label: "뒤 2초" },
];

/**
 * "이런 영상이면 충분해요" 예시(승원님 시안).
 *
 * 무엇을 찍어와야 하는지 알려주는 자리다. 전에는 기준이 없어서 원장님이 영상을 고를 때
 * 감으로 골라야 했다. 사진은 실제 시술 영상에서 뽑았고 셋 다 뒷모습이라 초상권 부담이 없다.
 */
export const EXAMPLE_SHOTS = [
  {
    src: "/sample-assets/shorts-example-before.jpg",
    label: "시술 전",
    hint: "손님 뒷모습이나 정면",
  },
  {
    src: "/sample-assets/shorts-example-process.jpg",
    label: "시술 과정",
    hint: "약 바르거나 자르는 손",
  },
  {
    src: "/sample-assets/shorts-example-after.jpg",
    label: "완성",
    hint: "한 바퀴 돌며",
  },
] as const;

export const DESCRIPTION_OPTIONS = [
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
export type ProgressStage = {
  from: number;
  ceiling: number;
  title: string;
  hint: string;
  /** 얼굴 블러를 끈 경우의 문구. 서버는 블러가 꺼져 있어도 같은 구간을 지나가므로
   * (PR #190), 하지도 않은 일을 화면이 말하지 않도록 갈라 쓴다. */
  titleWithoutBlur?: string;
  hintWithoutBlur?: string;
};

export const PROGRESS_STAGES: ProgressStage[] = [
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

export function progressStage(progress: number, blurFaces = true) {
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
export const LONG_RUNNING_SECONDS = 120;

export function defaultRole(index: number, total: number): VideoRole {
  if (index === 0) return "before";
  if (index === total - 1) return "after";
  return index % 2 ? "process" : "detail";
}
