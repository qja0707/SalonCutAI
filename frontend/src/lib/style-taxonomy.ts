// 미용실 시술 카테고리 체계 + 페르소나 상담 카드(설문) 데이터 정의

export const GENDERS = ["여성", "남성"] as const;
export const CUT_LENGTHS = ["숏", "단발", "미디움", "롱"] as const;
export const TEXTURES = ["스트레이트", "웨이브", "컬"] as const;
export const COLORS = [
  "블랙",
  "다크브라운",
  "초코브라운",
  "애쉬브라운",
  "베이지브라운",
  "애쉬그레이",
  "핑크브라운",
  "발레야주/옴브레",
  "기타",
] as const;
export const SERVICES = ["커트", "염색", "펌", "클리닉"] as const;

// 추구미 — 이번 시술로 지향하는 전체적인 분위기
export const AESTHETIC_VIBES = [
  "청순",
  "시크",
  "러블리",
  "청량",
  "우아",
  "내추럴",
  "걸크러시",
  "빈티지",
  "큐트",
  "모던",
  "글램",
  "스트릿",
] as const;

// 페르소나 설정(상담 카드) 문항 선택지 — 원본 상담지 3~15번 문항 기준
export const FASHION_STYLES = [
  "미니멀",
  "페미닌",
  "캐주얼",
  "스트릿",
  "클래식",
  "스포티",
  "빈티지",
  "오피스룩",
] as const;

export const IMAGE_KEYWORDS = [
  "청순한",
  "세련된",
  "지적인",
  "발랄한",
  "우아한",
  "시크한",
  "귀여운",
  "카리스마있는",
  "청량한",
  "부드러운",
  "도시적인",
  "자연스러운",
] as const;
export const IMAGE_KEYWORDS_MAX = 3;

export const FACE_CONCERNS = [
  "넓은 이마",
  "좁은 이마",
  "각진 턱선",
  "긴 얼굴",
  "큰 얼굴",
  "짧은 목",
  "높은 광대",
  "정수리 볼륨 부족",
] as const;

export const CHARM_POINTS = ["눈", "쌍꺼풀", "코", "입술", "목선", "쇄골", "귀", "피부톤"] as const;

export const PART_DIRECTIONS = ["왼쪽 가르마", "오른쪽 가르마", "가운데 가르마", "상관없음"] as const;

export const RECENT_TREATMENTS = [
  "매직(스트레이트)",
  "일반펌",
  "디지털펌",
  "염색",
  "탈색",
  "클리닉/트리트먼트",
  "최근 시술 없음",
] as const;

export const STYLING_TIME = ["5분 이내", "10~15분", "20~30분", "30분 이상"] as const;

export const HAIR_TOOLS = [
  "드라이기만",
  "고데기(매직기)",
  "롤브러시",
  "볼륨매직기",
  "에어랩/멀티스타일러",
  "따로 안 씀",
] as const;

export type PersonaAnswers = {
  occupation: string; // 3. 현재 직업 혹은 주된 활동 분야
  visitReason: string; // 4. 오늘 방문을 통해 변화를 주고 싶은 '이유'
  fashionStyle: string[]; // 5. 평소 선호하는 패션 스타일
  imageKeywords: string[]; // 6. 이번 시술로 얻고 싶은 '나의 이미지' 키워드 3가지
  avoidImage: string; // 7. 절대 피하고 싶은 이미지
  faceConcerns: string[]; // 8. 얼굴형·두상에서 신경 쓰이는 부분
  charmPoints: string[]; // 9. 드러내고 싶은 매력 포인트
  partDirection: string; // 10. 평소 가르마 방향
  recentTreatments: string[]; // 11. 최근 2년 이내 시술
  stylingTime: string; // 12. 평소 스타일링에 투자할 수 있는 시간
  hairTools: string[]; // 13. 평소 사용하는 헤어 도구
  messageToDesigner: string; // 15. 디자이너에게 하고 싶은 말
};

export const EMPTY_PERSONA: PersonaAnswers = {
  occupation: "",
  visitReason: "",
  fashionStyle: [],
  imageKeywords: [],
  avoidImage: "",
  faceConcerns: [],
  charmPoints: [],
  partDirection: "",
  recentTreatments: [],
  stylingTime: "",
  hairTools: [],
  messageToDesigner: "",
};
