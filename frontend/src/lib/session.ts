import {
  ApiRequestError,
  getCurrentUser,
  refreshSession,
} from "@/lib/api-client/client";
import { getCookie } from "@/lib/cookies";

/**
 * 이만큼도 안 남았으면 보내기 전에 미리 갱신한다.
 *
 * 영상 업로드는 최대 320MB 라 모바일에서 몇 분이 걸릴 수 있는데, 그 사이에 토큰이
 * 만료되면 스트림 요청이라 재시도가 안 된다(#192 논의). 사용자 테스트 초기값이고,
 * 실제 모바일 업로드 시간을 보고 조정한다.
 */
export const SESSION_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * 로그인 상태로 볼지.
 *
 * accessToken 은 30분이라 자주 사라지는데, refreshToken 이 남아 있으면 프록시가
 * 재발급해 주므로(`api-client/server/response.ts`) 둘 중 하나만 있어도 통과시킨다.
 * accessToken 만 보면 로그인한 지 30분 지난 사람을 막게 된다. 쿠키는 있는데 토큰이
 * 실제로 죽은 경우까지는 못 거르고, 그건 아래 `ensureFreshSession` 이나 401 문구가
 * 받는다.
 */
export function hasSession(): boolean {
  return Boolean(getCookie("accessToken") || getCookie("refreshToken"));
}

/**
 * 오래 걸리는 요청을 보내기 직전에 세션을 확인하고, 만료가 임박했으면 미리 갱신한다.
 *
 * @returns 계속 진행해도 되면 true, 로그인이 필요하면 false.
 *
 * 세션이 확실히 죽었을 때(401)만 false 다. `/auth/me` 가 아직 없는 배포(404)나 통신이
 * 잠깐 끊긴 경우까지 막으면, 정작 멀쩡한 업로드를 못 하게 된다 — 그런 경우는 통과시키고
 * 진짜 실패는 업로드 자신이 알려준다.
 */
export async function ensureFreshSession(): Promise<boolean> {
  if (!hasSession()) return false;

  try {
    const user = await getCurrentUser();
    if (Date.parse(user.expires_at) - Date.now() < SESSION_REFRESH_MARGIN_MS) {
      await refreshSession();
    }
    return true;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return false;
    return true;
  }
}
