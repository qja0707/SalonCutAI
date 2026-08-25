// 공개 미리보기 모드. 인증과 HTTPS가 없는 임시 공개 배포에서만 `1`로 설정한다.
//
// 이 모드에서는 사용자 API 키 입력과 외부 모델 호출을 막는다. 평문 HTTP 공개 주소에
// 키를 입력하면 전송 구간에서 그대로 노출되기 때문이다. UI에서 입력란을 숨기는 것만으로는
// 라우트를 직접 호출하는 경로가 남으므로, 서버 라우트에서도 함께 막는다.
//
// 로컬 개발(`.env.local` 미설정)에서는 꺼져 있으므로 기존 동작이 그대로 유지된다.
export const IS_PUBLIC_PREVIEW = process.env.NEXT_PUBLIC_PUBLIC_PREVIEW === "1";

export const PUBLIC_PREVIEW_NOTICE =
  "UI 검토용 공개 배포입니다. 예시 사진만 사용해주시고, 실제 고객 사진과 API 키는 입력하지 마세요.";

export const PUBLIC_PREVIEW_BLOCKED_MESSAGE =
  "UI 검토용 공개 배포에서는 외부 모델 호출이 비활성화되어 있습니다. 화면 흐름만 확인해주세요.";

/**
 * "개발자 정보" 패널·mock 시나리오 선택 같은 팀 전용 UI를 보여줄지.
 *
 * 예전엔 `!IS_PUBLIC_PREVIEW` 로만 가렸는데, 그건 임시 공개 미리보기 배포에만
 * 켜는 플래그다(실측 지적) — 인증 붙은 정식 배포는 이 플래그 없이 그냥
 * `next build` 로 띄우므로, 그 환경의 실사용자에게도 개발자 도구가 그대로
 * 보인다. `next build`(어떤 배포든)는 항상 NODE_ENV 를 production 으로 두므로,
 * 여기 기준으로 가리면 로컬 개발(`next dev`)에서만 보이고 배포 종류와
 * 무관하게 실사용자에게는 항상 숨는다.
 */
export const SHOW_DEV_TOOLS = process.env.NODE_ENV !== "production";
