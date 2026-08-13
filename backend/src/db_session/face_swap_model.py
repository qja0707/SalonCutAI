"""얼굴 교체 job 테이블.

메모리 dict 대신 DB 에 두는 이유는 배포 때문이다.
VM pull timer 가 5분마다 dev 최신 커밋을 확인하고 salon-api 를 재시작하는데,
그 순간 진행 중이던 job 이 사라지면 프론트가 무한 폴링에 빠진다.

기동 시 queued·processing 상태로 남은 job 은 failed 로 정리한다.
재시작으로 유실된 것이니 사용자가 재시도할 수 있게 한다.
"""

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from src.db_session.db import Base

# 프론트가 소문자 문자열을 그대로 비교한다. 다른 값이 가면 무한 폴링에 빠진다.
STATUS_QUEUED = "queued"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"


class FaceSwapJobModel(Base):
    __tablename__ = "face_swap_jobs"

    # face-{uuid4}. 추측이 어려워야 이미지 URL 을 인증 없이 열 수 있다.
    id = Column(String, primary_key=True, index=True)
    test_code = Column(String, nullable=False)
    status = Column(String, nullable=False, default=STATUS_QUEUED)
    attempt = Column(Integer, nullable=False, default=1)

    # 접수 당시 options 를 그대로 보관한다. retry 때 같은 조건으로 다시 돌린다.
    payload_json = Column(Text, nullable=False)

    # 완료 시에만 채운다. 3규격 URL 과 format_mode 가 들어간다.
    results_json = Column(Text)
    # 완료 시에만 채운다. {"seed": ..., "gen_sec": ...}
    meta_json = Column(Text)
    # 실패 시에만 채운다. {"code", "message", "retryable"}
    error_json = Column(Text)

    consent_recorded_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
