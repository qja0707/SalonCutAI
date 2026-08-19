"""참조 얼굴 목록·썸네일 라우터.

미리 만들어둔 가상 얼굴 32장을 프론트에 내려준다.
파일명만으로는 성별·국적·연령을 알 수 없어 메타데이터를 코드 상수로 둔다.
구성 근거는 combo3_spec.md 10장이다.

label 은 사용자에게 그대로 보이는 문구다. 생성 시 쓴 매력형·평범형 구분은
노출하지 않고 같은 조건 안에서 알파벳으로만 나눈다.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from src.ai_engine.image_gen import storage
from src.api.dependencies import check_auth_token
from src.exceptions.api_error import ApiError, new_request_id
from src.schemas.face_swap import ReferenceFace, ReferenceFacesResponse

router = APIRouter(
    prefix="/reference-faces",
    tags=["참조 얼굴"],
    dependencies=[Depends(check_auth_token)],
)


# --- 메타데이터 ---

# (id, label, gender, ethnicity, age_group)
REFERENCE_FACES: list[tuple[str, str, str, str, str]] = [
    ("ref-01", "한국인 20대 여성 A", "여성", "한국인", "20대"),
    ("ref-02", "한국인 20대 여성 B", "여성", "한국인", "20대"),
    ("ref-03", "한국인 20대 여성 C", "여성", "한국인", "20대"),
    ("ref-04", "한국인 20대 여성 D", "여성", "한국인", "20대"),
    ("ref-05", "한국인 20대 남성 A", "남성", "한국인", "20대"),
    ("ref-06", "한국인 20대 남성 B", "남성", "한국인", "20대"),
    ("ref-07", "한국인 20대 남성 C", "남성", "한국인", "20대"),
    ("ref-08", "한국인 30대 여성 A", "여성", "한국인", "30대"),
    ("ref-09", "한국인 30대 여성 B", "여성", "한국인", "30대"),
    ("ref-10", "한국인 30대 여성 C", "여성", "한국인", "30대"),
    ("ref-11", "한국인 30대 남성 A", "남성", "한국인", "30대"),
    ("ref-12", "한국인 30대 남성 B", "남성", "한국인", "30대"),
    ("ref-13", "한국인 40대 여성 A", "여성", "한국인", "40대"),
    ("ref-14", "한국인 40대 여성 B", "여성", "한국인", "40대"),
    ("ref-15", "한국인 40대 남성 A", "남성", "한국인", "40대"),
    ("ref-16", "한국인 40대 남성 B", "남성", "한국인", "40대"),
    ("ref-17", "한국인 50대 여성 A", "여성", "한국인", "50대"),
    ("ref-18", "한국인 50대 여성 B", "여성", "한국인", "50대"),
    ("ref-19", "한국인 50대 남성 A", "남성", "한국인", "50대"),
    ("ref-20", "한국인 50대 남성 B", "남성", "한국인", "50대"),
    ("ref-21", "일본인 20대 여성", "여성", "일본인", "20대"),
    ("ref-22", "중국인 20대 여성", "여성", "중국인", "20대"),
    ("ref-23", "서양인 20대 여성", "여성", "서양인", "20대"),
    ("ref-24", "동남아시아인 20대 여성", "여성", "동남아시아인", "20대"),
    ("ref-25", "흑인 20대 여성", "여성", "흑인", "20대"),
    ("ref-26", "중동인 20대 여성", "여성", "중동인", "20대"),
    ("ref-27", "일본인 20대 남성", "남성", "일본인", "20대"),
    ("ref-28", "중국인 20대 남성", "남성", "중국인", "20대"),
    ("ref-29", "서양인 20대 남성", "남성", "서양인", "20대"),
    ("ref-30", "동남아시아인 20대 남성", "남성", "동남아시아인", "20대"),
    ("ref-31", "흑인 20대 남성", "남성", "흑인", "20대"),
    ("ref-32", "중동인 20대 남성", "남성", "중동인", "20대"),
]


# --- 목록 ---


@router.get("", response_model=ReferenceFacesResponse)
def list_faces() -> ReferenceFacesResponse:
    """32장을 한 번에 내려준다. 화면에 필터가 없어 전부 격자로 나열한다."""
    items = [
        ReferenceFace(
            id=face_id,
            label=label,
            gender=gender,
            ethnicity=ethnicity,
            age_group=age_group,
            thumbnail_url=f"/api/v1/reference-faces/{face_id}/thumbnail",
        )
        for face_id, label, gender, ethnicity, age_group in REFERENCE_FACES
    ]
    return ReferenceFacesResponse(items=items, request_id=new_request_id())


# --- 썸네일 ---


@router.get("/{face_id}/thumbnail")
def thumbnail(face_id: str) -> FileResponse:
    """512px 로 줄여 내려준다. 원본은 장당 1.2MB 라 32장이면 37.8MB 다."""
    path = storage.ref_thumbnail_path(face_id)
    if path is None:
        raise ApiError(404, "RESULT_NOT_FOUND", "참조 얼굴을 찾을 수 없습니다.")

    return FileResponse(path, media_type="image/jpeg")
