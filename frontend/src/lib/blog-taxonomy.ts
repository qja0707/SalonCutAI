// 블로그 12필드 입력 폼의 보기값 정의 — Discussion #53 설계안 기준
//
// style-taxonomy.ts 와 분리한 이유:
//   상담 화면의 TEXTURES 는 "고객이 원하는 스타일링 형태"이고,
//   블로그의 hair_texture 는 "타고난 모질"이라 의미가 반대다. 같은 파일에 두면 섞여 쓰인다.
//   반대로 기장(CUT_LENGTHS)과 시술 대분류(SERVICES)는 의미가 같아 그대로 재사용한다.
//
// 모든 보기값은 계약이 아니라 "추천 어휘"다(승원님 8/11 UI 보정 1).
// 폼에서 직접 입력을 함께 제공하므로 목록에 없는 값도 전송될 수 있다.

import { CUT_LENGTHS, SERVICES } from "@/lib/style-taxonomy";

/** 시술 후 실제 모발 기장. 상담 화면과 같은 어휘를 쓴다. */
export const HAIR_LENGTHS = CUT_LENGTHS;

/** 타고난 모질. 상담 화면의 TEXTURES(원하는 스타일링 형태)와 다른 개념이다. */
export const HAIR_TEXTURES = ["직모", "반곱슬", "곱슬"] as const;

/** 모발 굵기. */
export const HAIR_THICKNESSES = ["가는 편", "보통", "굵은 편"] as const;

/** 손상도. 상담 화면에 추가될 문항과 같은 보기값을 써야 값이 그대로 넘어온다. */
export const DAMAGE_LEVELS = ["건강모", "약간 손상", "손상", "심한 손상"] as const;

/** 시술 대분류. 구체 시술명을 고르기 위한 1단계다. */
export const TREATMENT_CATEGORIES = SERVICES;

/**
 * 대분류별 구체 시술명 추천값.
 * 프롬프트가 제목에 구체적인 시술명을 요구해서 대분류만으로는 재료가 부족하다(승원님 UI 보정 2).
 *
 * 시술명이 곧 네이버 검색 키워드다 — 손님이 "허쉬펌", "모브브라운"으로 검색해서
 * 들어온다. 8/17 원장님 현업 키워드 + 네이버 검색 리서치로 채웠다:
 * - 남성 펌 계열(가르마펌·다운펌·애즈펌·아이롱펌)이 통째로 빠져 있던 것을 보강
 * - 표기는 검색량이 많은 쪽을 따른다: 에쉬 → 애쉬, 발레야주 → 발레아쥬
 */
export const TREATMENT_DETAILS: Record<(typeof TREATMENT_CATEGORIES)[number], readonly string[]> = {
  커트: ["레이어드컷", "단발컷", "허쉬컷", "울프컷", "슬릭컷", "샤기컷"],
  염색: [
    "애쉬브라운",
    "모브브라운",
    "올리브브라운",
    "버건디",
    "페이크블랙",
    "백금발",
    "초코브라운",
    "발레아쥬",
    "솜브레",
    "뿌리염색",
    "탈색",
  ],
  펌: [
    "빌드펌",
    "그레이스펌",
    "허쉬펌",
    "C컬 펌",
    "S컬펌",
    "히피펌",
    "엘리자벳펌",
    "복구펌",
    "볼륨매직",
    "디지털펌",
    "베이비펌",
    "가르마펌",
    "다운펌",
    "애즈펌",
    "아이롱펌",
  ],
  클리닉: ["케라틴 클리닉", "단백질 클리닉", "두피 클리닉", "실크 클리닉"],
};

/**
 * "고객이 겪던 불편" 추천 예시 — 롱테일 검색의 재료.
 *
 * 손님은 "예뻐지는 법"이 아니라 문제로 검색한다: "손상모 복구펌", "탈색없이
 * 애쉬브라운", "곱슬머리 매직셋팅". 도입 문단에 고민이 문장으로 들어가야 그 검색이
 * 걸린다(8/17 네이버 검색 리서치). 칩을 누르면 문장이 입력칸에 들어가고, 그대로
 * 두지 말고 손님 사례로 고쳐 쓰는 것이 목적이다 — label 은 칩 표시용 요약.
 */
export const PAIN_POINT_EXAMPLES = [
  { label: "손상모 복구", text: "탈색을 반복해서 머리가 푸석하고 손상이 심했습니다" },
  { label: "심한 곱슬", text: "곱슬이 심해서 아침마다 부스스하고 정리가 안 됐습니다" },
  { label: "볼륨 꺼짐", text: "모발이 얇아 볼륨이 금방 죽고 정수리가 눌렸습니다" },
  { label: "얼굴형 고민", text: "각진 얼굴형이 도드라져 보이는 게 고민이었습니다" },
  { label: "탈색 부담", text: "밝은 색을 하고 싶은데 탈색 손상이 부담스러웠습니다" },
  { label: "뜨는 옆머리", text: "옆머리가 떠서 인상이 강해 보이는 게 고민이었습니다" },
] as const;

/**
 * 시술 소요 시간.
 * ⚠️ 프롬프트가 `소요 시간: {duration_minutes}분` 으로 "분"을 이미 붙인다(blog_prompt.py:90).
 *    그래서 화면에는 `60분`을 보여주고 전송값은 `"60"` 이어야 한다.
 */
export const DURATION_MINUTES = ["30", "60", "90", "120", "180"] as const;

export function formatDuration(minutes: string): string {
  return `${minutes}분`;
}

/**
 * region_keyword 의 업종·시술 부분.
 * 지역명만 넣으면 "성수동"이 반복될 뿐이라 지역 검색이 안 잡힌다.
 * 프론트에서 `지역 + 업종`을 합쳐 한 문자열로 보낸다 — 백엔드 계약은 그대로 문자열 하나다.
 */
export const REGION_BUSINESSES = [
  "미용실",
  "헤어샵",
  "헤어살롱",
  "펌 전문",
  "염색 전문",
  // "성수동 탈색 전문"처럼 시술 전문성 조합이 지역 검색에 유리하다(8/17 리서치)
  "탈색 전문",
  "매직 전문",
] as const;

export function buildRegionKeyword(area: string, business: string): string {
  return [area.trim(), business.trim()].filter(Boolean).join(" ");
}
