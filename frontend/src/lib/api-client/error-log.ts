/**
 * 화면에 오류가 보이는 순간 서버(/api/client-errors)로 한 줄을 쏜다.
 *
 * 목적은 디버깅이다 — 테스터가 캡쳐를 보내주지 않아도 서버 로그에서 원인을
 * 조회할 수 있게 한다(#119 리뷰). 그래서 실패해도 조용해야 하고(기록하려다
 * 사용자 흐름을 깨면 본말전도), 같은 오류가 폴링마다 반복될 수 있어 잠깐 막는다.
 */

const REPORT_COOLDOWN_MS = 30_000;
const recent = new Map<string, number>();

export function reportClientError(entry: {
  code?: string;
  message: string;
  detail?: string;
  requestId?: string;
}): void {
  try {
    if (typeof window === "undefined") return;

    // 같은 오류의 반복 보고를 막는다. 폴링 실패는 2초마다 다시 온다.
    const key = `${entry.code ?? ""}|${entry.message}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last !== undefined && now - last < REPORT_COOLDOWN_MS) return;
    recent.set(key, now);

    const body = JSON.stringify({ ...entry, page: window.location.pathname });
    // keepalive — 화면 이동 중에도 전송이 끊기지 않는다. 응답은 기다리지 않는다.
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // 기록은 부가 기능이다. 어떤 실패도 삼킨다.
  }
}
