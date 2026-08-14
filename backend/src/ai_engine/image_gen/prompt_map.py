"""한글 옵션을 영문 프롬프트 어휘로 옮긴다.

프론트 face-taxonomy.ts 의 한글 값을 키로 쓴다. 목록에 없는 값이 오면
그 옵션만 조용히 빠진다. 한글은 SDXL 텍스트 인코더가 인식하지 못해
그대로 넣으면 무시되므로 여기서 반드시 바꾼다.

어휘는 사진 3장으로 재측정해 확정한 것이다. 표정 무표정 계열 8종과 립 2종은
부위·동작·색을 직접 지정하는 어휘로 교체했고, 동물상 9종은 이전 어휘를 유지한다.
"""

ETHNICITY = {
    "한국인": "korean",
    "일본인": "japanese",
    "중국인": "chinese",
    "동남아시아인": "southeast asian",
    "서양인": "caucasian",
    "흑인": "black",
    "라틴계": "latin american",
    "중동인": "middle eastern",
}

GENDER = {
    "여성": "woman",
    "남성": "man",
}

AGE_GROUP = {
    "10대": "teenager",
    "20대": "in their 20s",
    "30대": "in their 30s",
    "40대": "in their 40s",
    "50대 이상": "in their 50s or older",
}

# 동물 이름을 그대로 넣으면 결과가 파탄난다. 눈꼬리·코끝 묘사로 푼다.
FACE_STYLE = {
    "강아지상": "round downturned eyes, rounded nose tip, gentle friendly features",
    "고양이상": "upturned almond eyes, sharp nose tip, aloof chic features",
    "토끼상": "large round eyes, short nose, youthful innocent features",
    "사슴상": "large clear doe eyes, slim nose bridge, serene features",
    "여우상": "long narrow upturned eyes, refined sleek features",
    "곰상": "thick eyelids, broad low nose, easygoing features",
    "늑대상": "sharp eyes, high nose bridge, firmly set lips, mature features",
    "중성적인": "androgynous features",
    "개성 있는": "edgy distinctive features",
}

# 무표정 계열 8종은 눈·눈썹·입 세 부위를 모두 명시한다.
# 시선 지시는 세 사진 모두 정면을 그려 반영되지 않으므로 넣지 않는다.
EXPRESSION = {
    "무표정": "lips closed in a straight line, eyes level, relaxed brow",
    "자연스러운 미소": "natural soft smile",
    "활짝 웃는": "bright open smile",
    "수줍은 미소": "shy subtle smile",
    "눈웃음": "smiling eyes, crinkled eyes",
    "편안하고 여유로운": ("soft open eyes, loosened brows, lip corners barely lifted"),
    "밝고 에너지 넘치는": "cheerful energetic expression",
    "살짝 입꼬리만 올린 미소": (
        "one lip corner pulled up, eyes unchanged, teeth not showing"
    ),
    "도도한": "chin slightly raised, eyelids lowered, lip corners flat",
    "차갑고 날카로운 눈빛": (
        "slightly narrowed eyes, straight lowered brows, lips lightly pressed together"
    ),
    "강렬한 응시": (
        "wide open eyes fixed on camera, brows drawn slightly down, lips closed"
    ),
    "쿨하고 무심한": "half-lidded eyes, relaxed slack lips, brows unmoved",
    "생각에 잠긴": "one brow faintly raised, lips softly closed",
}

SKIN_TONE = {
    "밝은 톤": "fair light skin tone",
    "자연 톤": "natural medium skin tone",
    "태닝 톤": "deep tanned skin tone",
}

# 립 2종은 색 이름만으로는 같은 오렌지레드로 뭉개져 명도·채도·마감을 직접 지정한다.
MAKEUP = {
    "노메이크업": "no makeup, bare face",
    "꾸안꾸": "effortless no-makeup look",
    "속광": "lit-from-within inner glow",
    "물광": "dewy glass skin",
    "벨벳 블러": "soft-blurred velvet finish",
    "펄 스킨": "pearlescent highlight on cheekbones",
    "프로스티드 아이": "frosted white shimmer eyes",
    "취기 블러셔": "wide under-eye pink blush",
    "썬번": "sun-kissed flushed skin",
    "말린 장미": "muted rose MLBB lip",
    "벽돌빛": "dark muted brick lip, low saturation, matte finish",
    "프로스티드 립": "icy pink frosted gloss lip",
    "체리 레드": "bright vivid red lip, high saturation, glossy finish",
    "다크 로맨틱": "deep burgundy plum lip",
    "또렷한 눈매": "defined lifted eyes",
    "남성 그루밍": "groomed brows, even skin tone",
}

# 배경을 균일한 단색으로 지시하면 배경지처럼 보인다. 질감 단어를 붙인다.
BACKGROUND_STYLE = {
    "웜 화이트 미장 벽": "warm off-white plastered wall, soft texture",
    "그레이지 미장 벽": "greige plastered wall, subtle texture",
    "차콜 미장 벽": "charcoal plastered wall, matte texture",
    "우드 패널 벽": "warm wood panel wall",
    "린넨 커튼": "natural linen curtain, soft folds",
    "셰어 커튼 창가": "sheer curtain with diffused daylight",
    "우드톤 살롱": "warm wood salon interior, shallow depth of field",
    "미니멀 화이트 살롱": "minimal white salon interior, shallow depth of field",
    "인더스트리얼 살롱": "exposed concrete salon interior, shallow depth of field",
}

# 선택 항목의 축 이름과 딕셔너리를 짝지어둔다. 순서가 프롬프트 순서다.
_OPTIONAL_MAPS = [
    ("face_style", FACE_STYLE),
    ("expression", EXPRESSION),
    ("skin_tone", SKIN_TONE),
    ("makeup", MAKEUP),
]


def build_face_prompt(options) -> str:
    """FacePromptOptions 를 영문 프롬프트로 바꾼다.

    형식은 다음과 같다.
        a photorealistic face of a {국적} {성별}, {연령대}, {세부 옵션들}

    인종 표기를 빼면 서양인 얼굴이 나오므로 반드시 넣는다.
    """
    ethnicity = ETHNICITY.get(options.ethnicity, "")
    gender = GENDER.get(options.gender, "")
    age = AGE_GROUP.get(options.age, "")

    subject = " ".join(p for p in [ethnicity, gender] if p)
    parts = [subject] if subject else []
    if age:
        parts.append(age)

    for field, table in _OPTIONAL_MAPS:
        value = getattr(options, field, "")
        english = table.get(value)
        if english:
            parts.append(english)

    return "a photorealistic face of a " + ", ".join(parts)


def build_background_prompt(style: str | None) -> str:
    """배경 스타일을 영문으로 바꾼다. 목록에 없으면 빈 문자열."""
    if not style:
        return ""
    return BACKGROUND_STYLE.get(style, "")


def unmapped_values(options) -> list[str]:
    """매핑되지 않은 값 목록. 로그와 테스트에서 쓴다.

    프론트가 새 보기값을 추가했는데 여기에 안 넣으면 그 옵션이 조용히 빠진다.
    어긋난 것을 빨리 알기 위한 것이다.
    """
    missing = []
    for field, table in [
        ("ethnicity", ETHNICITY),
        ("gender", GENDER),
        ("age", AGE_GROUP),
        *_OPTIONAL_MAPS,
    ]:
        value = getattr(options, field, "")
        if value and value not in table:
            missing.append(f"{field}={value}")
    return missing
