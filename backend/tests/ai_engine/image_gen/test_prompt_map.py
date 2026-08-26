from src.ai_engine.image_gen import prompt_map
from src.schemas.face_swap import FacePromptOptions


def _opts(**kw):
    base = {"ethnicity": "한국인", "gender": "여성", "age": "20대"}
    return FacePromptOptions(**{**base, **kw})


def test_sentence_uses_style_sentence_for_three_styles():
    s = prompt_map.build_face_sentence(_opts(face_style="고양이상"))
    assert s.startswith("Replace the face with a different korean woman in their 20s")
    assert prompt_map.STYLE_SENT["고양이상"] in s
    assert prompt_map.FACE_STYLE["고양이상"] not in s


def test_sentence_falls_back_to_face_style_table():
    s = prompt_map.build_face_sentence(_opts(face_style="토끼상"))
    assert f"who has {prompt_map.FACE_STYLE['토끼상']}." in s


def test_sentence_appends_expression_and_makeup():
    s = prompt_map.build_face_sentence(_opts(expression="무표정", makeup="체리 레드"))
    assert f"Expression: {prompt_map.EXPRESSION['무표정']}." in s
    assert f"Makeup: {prompt_map.MAKEUP['체리 레드']}." in s


def test_sentence_ignores_skin_tone():
    s = prompt_map.build_face_sentence(_opts(skin_tone="태닝 톤"))
    assert prompt_map.SKIN_TONE["태닝 톤"] not in s
    assert "Skin" not in s


def test_sentence_ends_with_keep_size_clause():
    s = prompt_map.build_face_sentence(_opts())
    assert s.endswith("do not shrink or shift it.")
    assert "who has" not in s
