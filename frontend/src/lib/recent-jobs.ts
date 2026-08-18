// 오늘 만든 job 들을 브라우저에 남겨두기 — localStorage `salon_recent_jobs`
//
// "같은 설정으로 다음 사진"을 누르면 직전 결과가 화면에서 사라지는데, 서버에는
// 24시간 살아 있다. 다시 볼 입구가 없어서 저장을 빠뜨리면 되찾지 못했다.
// 여기 보관한 번호들로 하단 스트립을 그린다 — 목록 API 없이 개별 조회 API 만
// 쓰는 방식은 8/14에 승인된 그대로다(salon_recent_jobs 배열).
//
// active-job.ts 와 같은 이유로 localStorage 를 쓰고, 실패를 전부 삼킨다 —
// 보관이 안 될 뿐 생성 흐름은 계속돼야 한다.

export type RecentJob = {
  jobId: string;
  /** 완료를 본 시각. 서버 TTL(24h)을 흉내내 오래된 항목을 걸러내는 기준. */
  completedAt: number;
};

const KEY = "salon_recent_jobs";
const MAX_ITEMS = 12;
/** 서버 결과 보관과 같은 24시간. 지난 항목은 읽을 때 걸러 서버 404 왕복을 줄인다. */
const TTL_MS = 24 * 60 * 60 * 1_000;

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function write(jobs: RecentJob[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(jobs));
  } catch {
    // 용량 초과·프라이빗 모드. 스트립이 안 그려질 뿐이다.
  }
}

/** 저장된 최근 job 목록 — 최신순, 만료분 제거 후. 깨졌으면 빈 배열. */
export function readRecentJobs(): RecentJob[] {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const valid = parsed.filter(
      (item): item is RecentJob =>
        !!item &&
        typeof item === "object" &&
        typeof (item as RecentJob).jobId === "string" &&
        typeof (item as RecentJob).completedAt === "number",
    );
    const jobs = valid
      .filter((item) => now - item.completedAt < TTL_MS)
      .sort((a, b) => b.completedAt - a.completedAt);

    // 걸러낸 결과를 저장소에도 되쓴다. 안 그러면 만료·깨진 항목이 다음 추가·삭제
    // 때까지 원본에 남아, "24시간 자동 정리"라는 약속과 실제 저장 값이 어긋난다
    // (#116 리뷰). 내용이 줄었을 때만 쓴다 — 읽기마다 쓰면 낭비다.
    if (jobs.length !== parsed.length) write(jobs);

    return jobs;
  } catch {
    return [];
  }
}

/** 완료를 본 job 을 앞에 추가한다. 이미 있으면 시각만 그대로 두고 중복을 막는다. */
export function addRecentJob(jobId: string): void {
  const jobs = readRecentJobs();
  if (jobs.some((job) => job.jobId === jobId)) return;
  write([{ jobId, completedAt: Date.now() }, ...jobs].slice(0, MAX_ITEMS));
}

/** 서버에서 지웠거나(작업 삭제) 404 로 확인된 job 을 목록에서 뺀다. */
export function removeRecentJob(jobId: string): void {
  write(readRecentJobs().filter((job) => job.jobId !== jobId));
}
