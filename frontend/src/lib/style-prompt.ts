import type { PersonaAnswers } from "@/lib/style-taxonomy";

export type StylePromptInput = {
  services: string[];
  gender: string;
  cutLength: string;
  texture: string;
  color: string;
  aestheticVibes: string[];
  persona: PersonaAnswers;
};

function listOrNone(items: string[]) {
  return items.length > 0 ? items.join(", ") : "정보 없음";
}

// 실제 매장에서 쓰는 상담 카드(3~15번 문항)를 참고해 만든 프롬프트 빌더.
// 설문 항목 자체를 그대로 노출하는 게 목적이 아니라, 이 값들을 AI가 참고할
// "근거"로 프롬프트에 녹여 추천 품질을 끌어올리는 게 목적.
export function buildStylePrompt({
  services,
  gender,
  cutLength,
  texture,
  color,
  aestheticVibes,
  persona,
}: StylePromptInput) {
  return `너는 15년 경력의 헤어 디자이너 겸 이미지 컨설턴트야. 아래 상담 정보를 바탕으로
고객에게 딱 맞는 스타일을 제안하고, 실제 이미지 생성 AI에 넣을 프롬프트도 함께 설계해.

## 시술 정보
- 받고 싶은 시술: ${listOrNone(services)}
- 성별: ${gender || "정보 없음"}
- 원하는 커트 길이: ${cutLength || "정보 없음"}
- 원하는 텍스처: ${texture || "정보 없음"}
- 원하는 컬러: ${color || "정보 없음"}
- 추구미(원하는 전체 분위기): ${listOrNone(aestheticVibes)}

## 고객 상담 정보 (실제 매장 상담 카드 기준)
- 직업/주 활동 분야: ${persona.occupation || "정보 없음"}
- 방문 이유(변화를 원하는 이유): ${persona.visitReason || "정보 없음"}
- 평소 선호 패션 스타일: ${listOrNone(persona.fashionStyle)}
- 이번 시술로 얻고 싶은 이미지 키워드: ${listOrNone(persona.imageKeywords)}
- 절대 피하고 싶은 이미지: ${persona.avoidImage || "정보 없음"}
- 얼굴형/두상에서 신경 쓰이는 부분: ${listOrNone(persona.faceConcerns)}
- 드러내고 싶은 매력 포인트: ${listOrNone(persona.charmPoints)}
- 평소 가르마 방향: ${persona.partDirection || "정보 없음"}
- 최근 2년 이내 시술 이력: ${listOrNone(persona.recentTreatments)}
- 스타일링에 투자 가능한 시간: ${persona.stylingTime || "정보 없음"}
- 평소 사용하는 헤어 도구: ${listOrNone(persona.hairTools)}
- 디자이너에게 전하는 말: ${persona.messageToDesigner || "정보 없음"}

## 지침
- 얼굴형/두상 고민과 매력 포인트를 활용해 왜 이 스타일이 어울리는지 설명해.
- 피하고 싶은 이미지와 최근 시술 이력(탈색·매직 등 손상 위험)을 반드시 반영해서
  무리한 시술은 피하거나 주의사항으로 안내해.
- 스타일링 가능 시간과 보유 도구를 고려해서 관리 난이도가 맞는지 짚어줘.
- imagePrompt는 한국어가 아니라 영어로, 얼굴은 등장시키지 말고(no visible face)
  헤어스타일 자체에 집중한 photorealistic salon photography 프롬프트로 작성해.

반드시 아래 JSON 형식으로만 응답해:
{
  "recommendation": "추천 스타일 요약 (2~3문장, 구체적인 컷/컬러/펌 조합)",
  "reasons": "이 스타일을 추천하는 이유 (얼굴형·매력 포인트·추구미 근거로 3~4문장)",
  "cautions": "주의사항 (최근 시술 이력·모발 손상·스타일링 난이도 등 1~2문장, 해당 없으면 '특이사항 없음')",
  "imagePrompt": "이미지 생성 AI용 영문 프롬프트 (한 문단)"
}`;
}
