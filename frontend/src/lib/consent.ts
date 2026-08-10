// TODO(CONSENT-TEXT): 서비스·UI 담당 확인 후 문구와 정식 버전을 확정한다.
// TODO(CONSENT-RETENTION): 보관 기간 고지는 보관·삭제 정책(INFRA-002) 확정 후 추가한다.
//   자동 삭제는 현재 구현이 없으므로 문구에 넣지 않는다.
export const CONSENT_VERSION = "2026-08-09-draft";

export const CONSENT_CONTENT = {
  title: "사진 활용 동의 확인",
  introduction: "아래 내용을 고객님께 안내하고 동의를 받은 뒤 체크해주세요.",
  details: [
    "업로드한 시술 사진에서 얼굴만 가상 인물로 바꿔 홍보용 이미지를 만듭니다. 헤어·의상·배경은 그대로 유지됩니다.",
    "만들어진 이미지는 매장 홍보 콘텐츠로 사용됩니다.",
    "생성이 끝난 뒤 결과 화면에서 해당 작업을 삭제할 수 있습니다.",
  ],
  confirmation: "위 내용을 고객에게 안내하고 사진 활용 동의를 받았습니다.",
} as const;
