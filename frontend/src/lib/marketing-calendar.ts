export type Season = "봄" | "여름" | "가을" | "겨울";

export type CalendarMonth = {
  month: number;
  emoji: string;
  season: Season;
  theme: string;
  issue: string;
  promotion: string;
  services: string[];
  hashtags: string[];
  imagePrompt: string;
  blogTopic: string;
};

export const SEASON_STYLE: Record<Season, { bg: string; text: string }> = {
  봄: { bg: "linear-gradient(135deg, #FFD9E8 0%, #FFB7CE 100%)", text: "#7A1F42" },
  여름: { bg: "linear-gradient(135deg, #BEE9FF 0%, #7BC9F2 100%)", text: "#0B3B57" },
  가을: { bg: "linear-gradient(135deg, #F3C98B 0%, #D99A5B 100%)", text: "#4A2A10" },
  겨울: { bg: "linear-gradient(135deg, #DCE3F5 0%, #A9B8DE 100%)", text: "#1B2A4A" },
};

export const MARKETING_CALENDAR: CalendarMonth[] = [
  {
    month: 1,
    emoji: "🎍",
    season: "겨울",
    theme: "새해 변신",
    issue: "새해 다짐 시즌 · 정전기·건조 모발 고민",
    promotion: "New Year 스타일 체인지 패키지 + 정전기 방지 고보습 오일 케어",
    services: ["커트 체인지", "고보습 트리트먼트", "정전기 방지 헤어 오일"],
    hashtags: ["새해변신", "New Year New Style", "고보습케어", "정전기방지"],
    imagePrompt:
      "bright modern hair salon interior, new year theme, warm golden lighting, glossy healthy hair close-up, minimal elegant decoration, photorealistic, high detail",
    blogTopic: "새해를 맞아 이미지 변신을 고민하는 고객에게 어울리는 커트·컬러 추천과 겨울철 정전기·건조 모발 관리법",
  },
  {
    month: 2,
    emoji: "🎓",
    season: "겨울",
    theme: "졸업·발렌타인 인생샷",
    issue: "졸업식 시즌 · 발렌타인 데이트룩",
    promotion: "졸업식 맞춤 컷&드라이 패키지, 뿌리염색 세트 할인",
    services: ["졸업식 드라이", "뿌리염색", "히피펌"],
    hashtags: ["졸업식헤어", "인생샷", "발렌타인헤어", "뿌리염색"],
    imagePrompt:
      "elegant graduation-day hairstyle photoshoot, soft studio lighting, flower bouquet, celebratory mood, photorealistic portrait composition, no visible face",
    blogTopic: "졸업식 사진 촬영 전 꼭 해야 할 헤어 준비물과 사진이 잘 나오는 드라이·염색 팁",
  },
  {
    month: 3,
    emoji: "🌸",
    season: "봄",
    theme: "새출발 첫인상",
    issue: "입학·취업·황사 시즌 · 두피 트러블",
    promotion: "새내기·신입사원 첫인상 패키지, 봄맞이 두피 딥스케일링",
    services: ["톤업 염색", "두피 스케일링", "이미지 컨설팅 컷"],
    hashtags: ["첫인상변신", "봄맞이케어", "두피스케일링", "새학기"],
    imagePrompt:
      "fresh spring hair salon scene, cherry blossom petals near window, bright natural daylight, clean minimal styling station, photorealistic, airy pastel tones",
    blogTopic: "새 학기·새 직장을 앞두고 첫인상을 바꾸는 봄 헤어스타일과 황사철 두피 관리가 중요한 이유",
  },
  {
    month: 4,
    emoji: "🌷",
    season: "봄",
    theme: "벚꽃 나들이 컬러",
    issue: "벚꽃 나들이·소풍 시즌 · SNS 인증샷",
    promotion: "핑크 베이지·애쉬 톤업 염색 + 셀카 리뷰 이벤트",
    services: ["핑크 베이지 염색", "애쉬 톤업", "무스펌"],
    hashtags: ["벚꽃헤어", "톤업염색", "인생샷", "봄나들이"],
    imagePrompt:
        "cherry blossom park background, soft pink beige toned hair, golden hour sunlight, dreamy bokeh, photorealistic lifestyle photography, no visible face",
    blogTopic: "벚꽃놀이 인생샷에 어울리는 톤업 염색 컬러 추천과 봄철 컬러 유지 관리법",
  },
  {
    month: 5,
    emoji: "🌿",
    season: "봄",
    theme: "가정의 달 효도 이벤트",
    issue: "어버이날·스승의날 등 가정의 달",
    promotion: "부모님 동반 1+1 할인, 효도 헤어&스파 상품권",
    services: ["새치커버 염색", "두피 스파", "프리미엄 트리트먼트"],
    hashtags: ["효도이벤트", "가정의달", "새치커버", "부모님선물"],
    imagePrompt:
      "cozy warm salon interior, senior-friendly comfortable chair, soft caring atmosphere, warm May sunlight through window, photorealistic, no visible face",
    blogTopic: "가정의 달, 부모님께 선물하기 좋은 새치커버 염색과 두피 스파 상품권 아이디어",
  },
  {
    month: 6,
    emoji: "🌧️",
    season: "여름",
    theme: "장마철 곱슬 케어",
    issue: "장마철 시작 · 습도로 인한 곱슬·붕뜸",
    promotion: "볼륨매직 / 신데렐라 클리닉 / 슬릭펌 프로모션",
    services: ["볼륨매직", "슬릭펌", "신데렐라 클리닉"],
    hashtags: ["장마철곱슬", "볼륨매직", "슬릭펌", "아침드라이단축"],
    imagePrompt:
      "rainy window in the background, sleek smooth straight hair close-up, humid summer mood contrasted with glossy frizz-free result, photorealistic, high detail",
    blogTopic: "장마철 습도에도 부스스해지지 않는 슬릭펌·볼륨매직 효과와 아침 드라이 시간을 줄이는 법",
  },
  {
    month: 7,
    emoji: "🏖️",
    season: "여름",
    theme: "바캉스 컬러",
    issue: "여름 휴가·페스티벌 시즌",
    promotion: "발레야주·옴브레 하이라이트 + 쿨링 두피 스파 패키지",
    services: ["발레야주", "옴브레 하이라이트", "쿨링 두피 스파"],
    hashtags: ["바캉스컬러", "발레야주", "옴브레", "여름휴가헤어"],
    imagePrompt:
      "beach vacation vibe, sun-kissed balayage ombre hair, ocean and blue sky in soft background, bright summer photography, photorealistic, no visible face",
    blogTopic: "바닷가에서 빛나는 발레야주·옴브레 컬러 추천과 여름철 두피 쿨링 케어의 필요성",
  },
  {
    month: 8,
    emoji: "🔥",
    season: "여름",
    theme: "여름 손상모 회복",
    issue: "휴가 후 자외선·염수로 인한 극손상 모발",
    promotion: "SOS 애프터 바캉스 딥 단백질 복구 클리닉",
    services: ["단백질 클리닉", "케라틴 트리트먼트", "손상모 커트 정리"],
    hashtags: ["모발심폐소생", "단백질클리닉", "손상모케어", "여름휴가후"],
    imagePrompt:
      "before and after hair repair concept, damaged dry hair transforming into glossy healthy strands, salon treatment station, photorealistic, high detail macro shot",
    blogTopic: "여름 휴가 후 푸석해진 모발을 되살리는 단백질 클리닉과 케라틴 트리트먼트 관리 순서",
  },
  {
    month: 9,
    emoji: "🍂",
    season: "가을",
    theme: "추석 명절 단장",
    issue: "추석 명절 · 가족 모임 단정한 이미지",
    promotion: "가을 톤다운(밤브라운) 염색 + 새치커버 세트 할인",
    services: ["밤브라운 염색", "새치커버", "댄디 컷"],
    hashtags: ["추석단장", "가을톤다운", "새치커버", "명절헤어"],
    imagePrompt:
      "autumn toned chestnut brown hair, warm harvest-season lighting, traditional Korean holiday mood, elegant and neat styling, photorealistic, no visible face",
    blogTopic: "추석 명절 가족·친지 모임을 앞두고 단정하고 고급스러운 밤브라운 톤다운과 새치커버 추천",
  },
  {
    month: 10,
    emoji: "🍁",
    season: "가을",
    theme: "환절기 탈모 예방",
    issue: "환절기 탈모 증가 · 하객룩 웨딩 시즌",
    promotion: "환절기 탈모 예방 앰플 코스 + 하객 드라이 패키지",
    services: ["두피 스컬프 케어", "탈모 예방 앰플", "하객 드라이"],
    hashtags: ["가을탈모예방", "두피스컬프케어", "하객룩", "환절기케어"],
    imagePrompt:
      "autumn leaves scattered background, scalp care treatment close-up, ampoule bottles on salon table, warm caring mood, photorealistic, no visible face",
    blogTopic: "가을철 유독 심해지는 탈모, 두피 스컬프 케어와 탈모 예방 앰플 코스가 필요한 이유",
  },
  {
    month: 11,
    emoji: "📝",
    season: "가을",
    theme: "수능 대박 이벤트",
    issue: "수능 시험 시즌 · 수험생 스트레스 해소",
    promotion: "수험생 + 동반 1인 탈색·펌 50% 파격 할인 릴레이",
    services: ["탈색", "디지털펌", "두피 릴렉싱 스파"],
    hashtags: ["수능대박이벤트", "수험표할인", "고생했어", "펌50%할인"],
    imagePrompt:
      "celebratory relaxing salon mood, warm cozy lighting, student finishing exams concept, comfortable reclining wash chair, photorealistic, no visible face",
    blogTopic: "수능이 끝난 수험생을 위한 파격 할인 이벤트 기획법과 스트레스 해소 두피 스파 추천",
  },
  {
    month: 12,
    emoji: "🎄",
    season: "겨울",
    theme: "연말 파티 헤어",
    issue: "연말 모임·크리스마스·송년회 시즌",
    promotion: "홀리데이 파티 웨이브 펌 컬렉션 + VIP 연간 정액권",
    services: ["웨이브 펌", "업스타일 드라이", "VIP 정액권"],
    hashtags: ["연말파티헤어", "인생웨이브펌", "홀리데이스타일링", "VIP정액권"],
    imagePrompt:
      "festive holiday salon decoration, warm bokeh string lights, elegant wave curled hair close-up, party season glamour, photorealistic, no visible face",
    blogTopic: "연말 모임에서 주인공이 되는 웨이브 펌 스타일링과 단골에게 제안하기 좋은 VIP 연간 정액권 구성",
  },
];

export function getCalendarMonth(month: number): CalendarMonth | undefined {
  return MARKETING_CALENDAR.find((m) => m.month === month);
}
