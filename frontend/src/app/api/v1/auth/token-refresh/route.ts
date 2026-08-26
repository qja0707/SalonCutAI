import { getApiMode } from "@/lib/api-client/server/mode";
import {
  errorResponse,
  refreshSessionCookies,
} from "@/lib/api-client/server/response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 화면이 스스로 부르는 세션 갱신.
 *
 * 프록시에도 갱신 로직이 있지만 그쪽은 **백엔드가 401 을 준 뒤에야** 돌아간다. 영상
 * 업로드는 스트림이라 요청 도중 만료되면 재시도할 수 없어서(#192 논의), 보내기 전에
 * 미리 토큰을 받아둘 경로가 따로 필요하다.
 *
 * refresh_token 은 쿠키에서 읽어 서버에서 실어 보낸다 — 화면이 토큰 값을 직접 만지지
 * 않게 하려는 것이고, 갱신 락도 프록시와 공유한다(`refreshSessionCookies`).
 */
export async function POST() {
  if (getApiMode() !== "proxy") {
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const refreshed = await refreshSessionCookies();
  if (!refreshed) {
    return errorResponse(
      401,
      "UNAUTHORIZED",
      "인증 세션이 만료되었습니다. 다시 로그인 해주세요.",
    );
  }

  // 토큰 값 자체는 내려보내지 않는다. 쿠키는 이미 갱신됐고, 화면은 성공 여부만 알면 된다.
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
