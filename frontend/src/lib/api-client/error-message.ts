import { ApiRequestError } from "@/lib/api-client/client";
import { reportClientError } from "@/lib/api-client/error-log";

/**
 * 오류를 화면에 띄울 한국어 문구로 바꾼다.
 *
 * 호출부가 저마다 `error instanceof Error ? error.message : "…"` 를 쓰고 있었는데,
 * 이러면 **뒤쪽 한국어 기본값이 사실상 죽은 문구**가 된다. `fetch` 가 실패하면 던져지는
 * 것은 `TypeError` 이고 그것도 Error 라, 브라우저가 만든 영문이 그대로 화면에 올라갔다
 * (크롬 `Failed to fetch`, 사파리 `Load failed`, 파이어폭스 `NetworkError …`).
 * 서버 재시작·VM 재기동·이동 중 끊김이 전부 이 경로로 떨어지므로 실사용에서 가장 자주 보였다.
 *
 * 백엔드가 주는 문구는 대부분 이미 한국어라 그대로 쓴다. 다만 예외 문자열이 그대로
 * 실려오는 자리가 있어(영상 job 실패의 `str(exc)`) 코드가 있으면 코드를 먼저 본다.
 *
 * 문구는 원장님 확정(2026-08-18). 근거는 `docs/20260818_오류문구_전수조사.md`.
 */

/** 화면 문구가 정해져 있는 오류 코드. 백엔드 메시지보다 이쪽을 우선한다. */
const MESSAGE_BY_CODE: Record<string, string> = {
  // 백엔드가 파이썬 예외 문자열을 그대로 실어 보내는 자리다.
  VIDEO_PROCESSING_FAILED: "영상을 만들다 문제가 생겼어요. 클립 설정을 바꿔 다시 시도해주세요.",
  // proxy 경로에서 예외가 났을 때. 원인은 서버 로그에만 남긴다.
  INTERNAL_ERROR: "서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.",
};

const NETWORK_MESSAGE = "연결이 끊겼어요. 인터넷 상태를 확인하고 다시 시도해주세요.";

/**
 * 로그인하지 않고 기능을 누른 경우.
 *
 * 백엔드는 토큰이 만료·무효일 때는 한국어로 알려주지만(`토큰이 만료되었습니다`),
 * 토큰이 아예 없으면 FastAPI 기본 문구인 영문 `Not authenticated` 가 그대로
 * 내려온다. 로그인 전에는 세 기능 어느 것을 눌러도 이 문구를 보게 된다.
 */
const AUTH_MESSAGE = "로그인이 필요해요. 로그인 후 다시 시도해주세요.";
const FASTAPI_NOT_AUTHENTICATED = "Not authenticated";
const FALLBACK_MESSAGE = "문제가 생겼어요. 잠시 후 다시 시도해주세요.";

/**
 * `fetch` 가 요청 자체를 못 보낸 경우인지.
 *
 * 브라우저마다 문구가 다르고 앞으로 또 바뀔 수 있어 문자열로 판정하지 않는다.
 * 요청이 서버에 닿았다면 `ApiRequestError`(상태 코드 있음)로 올라온다.
 */
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

/**
 * 화면에 띄울 문구.
 *
 * @param fallback 이 화면에서 무엇을 하다 실패했는지 알려주는 문구.
 *                 원인을 특정할 수 없을 때만 쓰인다.
 */
export function errorMessage(error: unknown, fallback = FALLBACK_MESSAGE): string {
  if (isNetworkError(error)) {
    reportClientError({ code: "NETWORK", message: NETWORK_MESSAGE, detail: String(error) });
    return NETWORK_MESSAGE;
  }

  if (error instanceof ApiRequestError) {
    // 한국어 문구가 실려 온 401·403 은 그대로 쓴다(토큰 만료, 공개 미리보기 차단).
    // 문구가 없거나 FastAPI 기본 영문일 때만 로그인 안내로 바꾼다.
    if (
      (error.status === 401 || error.status === 403) &&
      (!error.message || error.message === FASTAPI_NOT_AUTHENTICATED)
    ) {
      reportClientError({ code: `HTTP_${error.status}`, message: AUTH_MESSAGE });
      return AUTH_MESSAGE;
    }

    // 상태 코드만으로 판정할 수 있는 것들. 백엔드 문구가 비어 있어도 안내가 나가야 한다.
    const message =
      error.status >= 500 && !error.message
        ? MESSAGE_BY_CODE.INTERNAL_ERROR
        : error.message || fallback;
    reportClientError({ code: `HTTP_${error.status}`, message });
    return message;
  }

  if (error instanceof Error) {
    reportClientError({ message: error.message || fallback, detail: error.name });
    return error.message || fallback;
  }
  return fallback;
}

/**
 * job 응답 안에 실린 실패 정보를 화면 문구로.
 * 코드에 정해둔 문구가 있으면 그것을 쓰고, 없으면 백엔드 한국어 문구를 그대로 쓴다.
 */
export function jobErrorMessage(
  jobError: { code?: string; message?: string } | null | undefined,
  fallback = FALLBACK_MESSAGE,
): string {
  if (!jobError) return fallback;
  const byCode = jobError.code ? MESSAGE_BY_CODE[jobError.code] : undefined;
  const message = byCode ?? jobError.message ?? fallback;
  reportClientError({ code: jobError.code, message, detail: byCode ? jobError.message : undefined });
  return message;
}

// 원문 오류는 화면에 올리지 않는다 — 백엔드 예외 문자열에 내부 경로·명령 인자가
// 섞여 나올 수 있음이 실측으로 확인됐다(#119 리뷰). 진단용 원문은 jobErrorMessage 가
// reportClientError 의 detail 로 서버 오류 로그에만 남긴다.
