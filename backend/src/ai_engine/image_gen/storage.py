"""파일 저장 경로와 입출력.

GCS 는 권한 이슈로 제외했고 VM 로컬 디스크를 쓴다.
job 1건당 원본 1장 + 결과 3장으로 최대 8MB 정도다.
24시간 TTL 이면 하루 100건을 처리해도 800MB 수준이라 여유가 있다.

    storage/
        ref_faces/          ref-01.png ~ ref-32.png (37.8MB, 고정)
            thumb/          512px 썸네일. 첫 요청 때 만들어 재사용한다
        face_swap/{job_id}/
            source.jpg      원본. retry 때 다시 쓴다
            1x1.jpg  4x5.jpg  9x16.jpg
"""

from pathlib import Path

from PIL import Image

from src.ai_engine.image_gen import settings


def job_dir(job_id: str) -> Path:
    """job 전용 폴더를 만들고 경로를 돌려준다."""
    path = settings.JOB_DIR / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def source_path(job_id: str) -> Path:
    return job_dir(job_id) / "source.jpg"


def result_path(job_id: str, ratio_key: str) -> Path:
    """ratio_key 는 1x1·4x5·9x16 처럼 URL 표기를 쓴다."""
    return job_dir(job_id) / f"{ratio_key}.jpg"


def ref_face_path(ref_id: str) -> Path:
    return settings.REF_FACES_DIR / f"{ref_id}.png"


def save_source(job_id: str, data: bytes) -> Path:
    """업로드 원본을 저장한다. 폰 사진은 4000px 이 넘어 긴 변을 제한한다."""
    path = source_path(job_id)
    path.write_bytes(data)

    img = Image.open(path).convert("RGB")
    if max(img.size) > settings.OUTPUT_MAX_SIDE:
        scale = settings.OUTPUT_MAX_SIDE / max(img.size)
        img = img.resize(
            (int(img.width * scale), int(img.height * scale)), Image.LANCZOS
        )
    img.save(path, "JPEG", quality=settings.JPEG_QUALITY)
    return path


def save_result(job_id: str, ratio_key: str, img: Image.Image) -> Path:
    path = result_path(job_id, ratio_key)
    img.convert("RGB").save(path, "JPEG", quality=settings.JPEG_QUALITY)
    return path


def ref_thumbnail_path(ref_id: str) -> Path | None:
    """썸네일을 만들어 캐시하고 경로를 돌려준다. 원본이 없으면 None.

    원본이 장당 1.2MB 라 32장을 그대로 내리면 한 화면에 38MB 가 된다.
    """
    src = ref_face_path(ref_id)
    if not src.exists():
        return None

    settings.REF_THUMB_DIR.mkdir(parents=True, exist_ok=True)
    thumb = settings.REF_THUMB_DIR / f"{ref_id}.jpg"
    if thumb.exists():
        return thumb

    img = Image.open(src).convert("RGB")
    side = settings.THUMBNAIL_SIDE
    img.resize((side, side), Image.LANCZOS).save(
        thumb, "JPEG", quality=settings.JPEG_QUALITY
    )
    return thumb


def delete_job_files(job_id: str) -> None:
    """job 삭제 시 폴더째 지운다."""
    path = settings.JOB_DIR / job_id
    if not path.exists():
        return
    for f in path.iterdir():
        f.unlink()
    path.rmdir()
