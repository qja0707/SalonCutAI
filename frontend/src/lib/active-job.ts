// 진행 중인 job 을 브라우저에 남겨두기 — localStorage
//
// job 은 서버에 24시간 살아있는데(mock TTL) 화면은 job_id 를 useState 로만 들고 있었다.
// 새로고침 한 번이면 번호를 잃어 결과를 되찾을 방법이 없다. 디자이너가 퇴근 후 여러 장을
// 몰아서 처리하는 흐름이라 실제로 걸린다.
//
// 쿠키(blog-profile.ts)가 아니라 localStorage 를 쓰는 이유: 이 값은 서버가 읽을 일이 없다.
// 쿠키로 두면 모든 요청 헤더에 얹혀 나간다.
//
// 저장하는 것은 job_id 와 시작 시각뿐이다. 업로드한 사진(File)과 폼 입력값은 복구하지 않는다.

/**
 * 화면마다 저장 칸을 따로 쓴다.
 *
 * 지금은 얼굴 교체 하나뿐이다. 블로그는 job 방식이 아니라 동기 호출로 가기로 해서
 * (백엔드에 있는 것은 `/api/v1/text-gen/blog-generation` 하나이고 blog job API 는 없다)
 * 복구할 job 자체가 없다.
 */
export type ActiveJobKind = "face-swap";

export type ActiveJob = {
  jobId: string;
  /** 진행 문구의 경과 초 기준점. 재시도하면 그 시각으로 다시 잡는다. */
  startedAt: number;
};

const KEY_PREFIX = "salon_active_job";

function storageKey(kind: ActiveJobKind): string {
  return `${KEY_PREFIX}:${kind}`;
}

/**
 * localStorage 는 없을 수도(서버 렌더) 접근 자체가 막힐 수도 있다(사파리 프라이빗 모드).
 * 막혔다면 복구가 안 될 뿐이고 생성은 그대로 되어야 하므로, 실패를 전부 삼킨다.
 */
function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 저장된 job. 없거나 형식이 깨졌으면 null. */
export function readActiveJob(kind: ActiveJobKind): ActiveJob | null {
  try {
    const raw = storage()?.getItem(storageKey(kind));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const value = parsed as Partial<ActiveJob>;
    if (typeof value.jobId !== "string" || !value.jobId) return null;

    return {
      jobId: value.jobId,
      // 시작 시각만 깨진 경우까지 버리지는 않는다. 경과 초가 0부터 다시 세질 뿐이다.
      startedAt: typeof value.startedAt === "number" ? value.startedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeActiveJob(kind: ActiveJobKind, job: ActiveJob): void {
  try {
    storage()?.setItem(storageKey(kind), JSON.stringify(job));
  } catch {
    // 용량 초과·프라이빗 모드. 복구를 못 할 뿐 생성은 계속돼야 한다.
  }
}

export function clearActiveJob(kind: ActiveJobKind): void {
  try {
    storage()?.removeItem(storageKey(kind));
  } catch {
    // 위와 같다.
  }
}
