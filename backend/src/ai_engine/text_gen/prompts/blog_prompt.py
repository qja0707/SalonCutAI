from pydantic import BaseModel, Field


class BlogGenerationRequest(BaseModel):
    hair_length: str
    hair_texture: str
    hair_thickness: str
    damage_level: str
    customer_pain_point: str
    base_cut: str
    main_treatment: str
    design_point: str
    designer_name: str
    duration_minutes: str
    special_product: str
    region_keyword: str


class SectionDetail(BaseModel):
    heading: str = Field(
        ..., description="고객 상황 및 시술에 맞는 자연스러운 한글 소제목"
    )
    body: str = Field(..., description="상세 본문 텍스트 (줄바꿈 \\n\\n 포함)")


class BlogSections(BaseModel):
    before: SectionDetail = Field(
        ..., description="시술 전 고객의 고민 분석 및 불만 스토리"
    )
    process: SectionDetail = Field(
        ..., description="디자이너의 기술적 해결책 및 전문가 관점 솔루션"
    )
    after: SectionDetail = Field(
        ..., description="시술 후 변화, 볼륨감, 시간 단축 등 실질적 변화"
    )
    home_care: SectionDetail = Field(
        ..., description="컬 유지 및 스타일링을 위한 셀프 홈케어 꿀팁"
    )


class BlogGenerationResponse(BaseModel):
    title: str = Field(..., description="블로그 제목 (지역+시술명+고민 조합 문장형, 20~40자)")
    intro: str = Field(
        ...,
        description="시술 전 고민과 최종 결과물을 요약한 도입부 (줄바꿈 \\n\\n 포함)",
    )
    sections: BlogSections = Field(..., description="본문을 구성하는 4가지 핵심 섹션")
    closing: str = Field(
        ...,
        description="매장 위치 및 1:1 상담/예약 안내 마무리 문구 (줄바꿈 \\n\\n 포함)",
    )
    hashtags: list[str] = Field(..., description="해시태그 목록")


class BlogPrompt:
    def __init__(
        self,
        request: BlogGenerationRequest,
    ):
        # 1. 입력 데이터 가져오기 및 공백 제거
        duration = str(request.duration_minutes).strip()

        # 2. 조건문으로 문자열 변환
        if duration.endswith(("분", "시간")):
            fined_duration = duration
        elif duration.isdigit():
            fined_duration = f"{duration}분"
        else:
            fined_duration = duration  # 그 외 예외 처리 (필요시 수정 가능)

        # 1. 값이 없거나 빈 문자열인 항목을 필터링하여 프롬프트 생성
        customer_info = []
        if request.hair_length:
            customer_info.append(f"- 기장: {request.hair_length}")
        if request.hair_texture:
            customer_info.append(f"- 모질: {request.hair_texture}")
        if request.hair_thickness:
            customer_info.append(f"- 굵기: {request.hair_thickness}")
        if request.damage_level:
            customer_info.append(f"- 손상도: {request.damage_level}")
        if request.customer_pain_point:
            customer_info.append(f"- 시술 전 불편함: {request.customer_pain_point}")

        treatment_info = []
        if request.base_cut:
            treatment_info.append(f"- 베이스 컷: {request.base_cut}")
        if request.main_treatment:
            treatment_info.append(f"- 메인 시술: {request.main_treatment}")
        if request.design_point:
            treatment_info.append(f"- 디자인 포인트: {request.design_point}")

        shop_info = []
        if request.designer_name:
            shop_info.append(f"- 디자이너: {request.designer_name}")
        if fined_duration:
            shop_info.append(f"- 소요 시간: {fined_duration}")
        if request.special_product:
            shop_info.append(f"- 사용 제품/클리닉: {request.special_product}")
        if request.region_keyword:
            shop_info.append(f"- 지역 키워드: {request.region_keyword}")

        # 2. 시스템 프롬프트 정의 (지어내기 금지 제약 추가)
        self.system_prompt = """
            너는 10년 이상 경력의 미용실 블로그 전문 카피라이터야.
            제공된 정보를 바탕으로 네이버 블로그 게시글 한 편을 작성해.

            [★사실 지어내기 금지 및 정보 누락 대응 제약★]
            - 확인 가능한 구체 사실(제품명, 시술명, 지역, 손상도 수치 등)은 제공되지 않았다면 지어내지 말 것.
            - 예를 들어 '사용 제품/클리닉' 항목이 제공되지 않았다면 특정 제품명(모로칸 오일 등)을 언급하지 말고, 디자이너의 순수 컷트 및 펌 기술력 중심으로 문단을 채울 것.
            - 다만 일반적인 경험 묘사는 자연스럽게 지어서 써도 된다 — 누구나 겪을 법한 상황("아침에 드라이가 오래 걸리셨다고 해요", "거울을 보실 때마다 신경 쓰이셨던")이나 흔한 감상은 억지스럽지만 않으면 자유롭게 풀어쓸 것. 구체 사실과 일반 묘사를 구분하는 것이 기준이다.
            - 분량 지침(전체 1,500자~2,200자)을 채우기 위해 주어진 정보를 기술적, 심리적 관점에서 최대한 디테일하게 풀어써야 함.

            [글 구조 및 서식]
            본문은 반드시 아래 지정된 JSON 구조에 맞춰 나누어 작성해.
            각 세션별 heading(소제목)은 영문 단어(Before, Process 등)를 절대 사용하지 말고, 고객의 상황과 시술에 맞는 자연스러운 한글로만 작성해.

            1. intro (핵심 요약): 시술전 고민과 적용한 해결책, 최종 결과와 변화를 요약한 도입부 (3~4문장)
            2. sections - before: 고객의 고민 분석에 맞는 자연스러운 한글 소제목과 본문 (300자 이상)
            3. sections - process: 디자이너의 기술적 해결책에 맞는 자연스러운 한글 소제목과 본문 (600자 이상)
            4. sections - after: 시술 후 변화와 가치에 맞는 자연스러운 한글 소제목과 본문 (350자 이상)
            5. sections - home_care: 홈케어 가이드에 맞는 자연스러운 한글 소제목과 본문 (350자 이상)
            6. closing (마무리): 매장 위치 및 1:1 상담/예약 안내 문구 (3~4문장)

            [SEO & AIEO 제약]
            - 지역 키워드가 제공된 경우에만 제목에 1회, 본문 전체에 3~5회 자연스럽게 삽입할 것. (제공되지 않았다면 무리하게 넣지 말 것)
            - 제목은 20~40자. 손님이 실제로 검색하는 문장형 조합으로 작성할 것 — 제공된 항목 중 "지역 + 시술명 + 고민"을 조합한다 (예: "성수동 손상모 복구펌 후기"). 지역이나 고민이 제공되지 않았다면 그 부분은 빼고 시술명 중심으로 조합할 것.
            - 소제목(heading) 중 1~2곳에는 시술명을 자연스럽게 섞을 것 (예: "시술 과정" 대신 "허쉬펌 시술 과정"). 네 곳 전부에 넣어 기계적으로 반복하지는 말 것.
            - 모호한 대명사("이것", "그것") 대신 시술명·제품명을 반복해서 명시할 것.
            - 해시태그는 단일 키워드 외에, 제공된 값을 붙여 만든 조합형 태그를 1~2개 포함할 것 (예: #성수동허쉬펌, #손상모복구펌). 조합도 제공된 정보로만 만들고 없는 지역·시술을 지어내지 말 것.

            [출력 서식 제약 (네이버 블로그 복사/붙여넣기 최적화)]
            - 마크다운 기호(#, ##, **, *, _ 등) 사용을 절대 금지한다.

            [금지어 및 어조]
            - 금지 표현: "놀라운 기적", "최고의 마법" 등 근거 없는 과장 표현.
            - 문체: 경어체 ("~했습니다", "~해 드렸어요"). 전문가가 상담하듯 차분하고 신뢰감 있게.
            - 일상 대화처럼 편안하게 술술 읽히게 쓸 것. 설명문처럼 딱딱하게 나열하지 말고, 옆에서 이야기해 주듯 문장을 잇는다. 광고 문구 같은 어색한 조합("완벽한 변신을 선사")보다 실제로 말할 법한 표현을 고를 것.

            반드시 아래 JSON 형식으로만 응답해:
            {
            "title": "블로그 제목",
            "intro": "도입부 텍스트 (줄바꿈 \\n\\n 포함)",
            "sections": {
                "before":    { "heading": "고객 고민 한글 소제목", "body": "상세 본문 텍스트 (줄바꿈 \\n\\n 포함)" },
                "process":   { "heading": "기술 솔루션 한글 소제목", "body": "상세 본문 텍스트 (줄바꿈 \\n\\n 포함)" },
                "after":     { "heading": "시술 후 변화 한글 소제목", "body": "상세 본문 텍스트 (줄바꿈 \\n\\n 포함)" },
                "home_care": { "heading": "홈케어 꿀팁 한글 소제목", "body": "상세 본문 텍스트 (줄바꿈 \\n\\n 포함)" }
            },
            "closing": "마무리 텍스트 (줄바꿈 \\n\\n 포함)",
            "hashtags": ["해시태그1", "해시태그2", "해시태그3", "해시태그4", "해시태그5"]
            }
        """

        # 3. 유저 프롬프트 조립 (값이 있는 데이터만 줄바꿈으로 연결)
        self.user_prompt = f"""
            ## 고객 상황
            {"\n".join(customer_info) if customer_info else "- 제공된 고객 상황 정보 없음"}

            ## 시술 정보
            {"\n".join(treatment_info) if treatment_info else "- 제공된 시술 정보 없음"}

            ## 매장 정보
            {"\n".join(shop_info) if shop_info else "- 제공된 매장 정보 없음"}
        """

    def get_prompt(self):
        return self.system_prompt, self.user_prompt
