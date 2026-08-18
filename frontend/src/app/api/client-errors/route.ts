import { NextResponse } from "next/server";

import { appendClientErrorLog } from "@/lib/server/client-error-file-log";

/**
 * 화면에서 본 오류를 서버 로그로 받는 자리.
 *
 * 테스트 단계에서 오류 원인을 파악할 내부 기록이 없다는 지적(#119 리뷰)에 대한 답이다.
 * 화면에 오류 문구가 뜨는 순간 클라이언트가 여기로 한 줄을 쏘고, 서버 콘솔과
 * **날짜별 로그 파일**(`logs/client-errors/`, 7일 보관 후 자동 삭제)에 JSON 으로 남는다.
 * 콘솔은 데몬 환경에서 유실될 수 있다는 리뷰 지적에 따라 파일 저장이 정본이다.
 * 테스터가 캡쳐를 보내주지 않아도 서버 쪽에서 무엇이 언제 났는지 조회할 수 있다.
 *
 * 수집기는 정확성보다 견고함이 우선이다: 본문이 이상해도 500 을 내지 않고,
 * 필드는 길이를 잘라 로그 오염을 막는다. 응답을 기다리는 호출자도 없다.
 */

const MAX_FIELD = 500;
// 수집 항목 전부가 MAX_FIELD 로 잘리므로 정상 본문은 수 KB 를 넘지 않는다.
// 인증 없는 엔드포인트라 큰 본문은 읽기 전에 거절한다(#119 리뷰).
const MAX_BODY_BYTES = 16 * 1024;

function clip(value: unknown): string {
  return String(value ?? "").slice(0, MAX_FIELD);
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0 || length > MAX_BODY_BYTES) {
    // content-length 가 없거나 상한을 넘으면 본문을 읽지 않고 끝낸다.
    return new NextResponse(null, { status: 413 });
  }
  try {
    const body: unknown = await request.json();
    const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const line = JSON.stringify({
      at: new Date().toISOString(),
      page: clip(data.page),
      code: clip(data.code),
      message: clip(data.message),
      detail: clip(data.detail),
      requestId: clip(data.requestId),
      userAgent: clip(request.headers.get("user-agent")),
    });
    console.error("[client-error]", line);
    await appendClientErrorLog(line);
  } catch {
    // 기록 실패가 사용자 흐름에 영향을 주면 안 된다. 조용히 버린다.
  }
  return new NextResponse(null, { status: 204 });
}
