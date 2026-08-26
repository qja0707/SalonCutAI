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
 * @throws 서버 오류·통신 실패. 호출부가 제 문구로 알리도록 그대로 올려보낸다.
 *
 * 세 갈래로 나눈다(#193 리뷰).
 *
 * - **401** 은 세션이 확실히 죽은 경우라 false — 로그인 안내로 보낸다.
 * - **404** 는 `/auth/me` 가 아직 없는 배포다. 확인을 건너뛰고 업로드로 넘어간다.
 * - **그 밖(5xx·통신 실패)** 은 로그인 문제가 아니다. 여기서 false 를 주면 멀쩡히
 *   로그인된 사람에게 "로그인이 필요해요" 를 띄우게 되고, 로그인해도 또 실패한다.
 *   그렇다고 그대로 업로드를 시작하면 320MB 를 다 올린 뒤에 실패한다 — 올려보내서
 *   업로드 전에 멈추되, 무엇이 잘못됐는지는 제대로 알리게 한다.
 */
export async function ensureFreshSession(): Promise<boolean> {
  if (!hasSession()) return false;

  try {
    const user = await getCurrentUser();
    if (Date.parse(user.expires_at) - Date.now() < SESSION_REFRESH_MARGIN_MS) {
      await refreshSession();
    }
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.status === 401) return false;
      if (error.status === 404) return true;
    }
    throw error;
  }
  return true;
}
