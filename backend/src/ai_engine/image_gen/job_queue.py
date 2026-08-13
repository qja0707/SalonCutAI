"""단일 워커 큐.

GPU 추론은 블로킹이다. pipe(...) 호출이 수 초간 GIL 을 잡고 돌아가므로
FastAPI 이벤트 루프에서 직접 부르면 그동안 폴링 요청이 전부 멈춘다.
프론트가 2초마다 폴링하기 때문에 즉시 드러난다.

그래서 별도 스레드에서 처리한다. 스레드가 하나뿐인 이유는 VRAM 이다.
조합 3·5 동시 상주 시 생성 피크가 21.4GB 이고 L4 는 23GB 라
두 요청이 겹치면 OOM 이 난다. 동시성은 큐가 흡수한다.
"""

import logging
import queue
import threading
from collections.abc import Callable

logger = logging.getLogger(__name__)

_queue: "queue.Queue[str]" = queue.Queue()
_worker: threading.Thread | None = None
_processor: Callable[[str], None] | None = None

# 대기 순번 계산용. 큐에 넣은 순서를 그대로 유지한다.
_pending: list[str] = []
_lock = threading.Lock()


def set_processor(fn: Callable[[str], None]) -> None:
    """job 하나를 처리하는 함수를 등록한다.

    큐 모듈은 스케줄링만 알고 도메인 로직은 모른다.
    service 계층이 순환 import 없이 자기 함수를 넘긴다.
    """
    global _processor
    _processor = fn


def enqueue(job_id: str) -> int:
    """큐에 넣고 대기 순번을 돌려준다. 1이면 바로 다음 차례다."""
    with _lock:
        _pending.append(job_id)
        position = len(_pending)
    _queue.put(job_id)
    return position


def position(job_id: str) -> int | None:
    """대기 중이면 순번, 아니면 None."""
    with _lock:
        if job_id not in _pending:
            return None
        return _pending.index(job_id) + 1


def _run() -> None:
    while True:
        job_id = _queue.get()
        try:
            if _processor is None:
                logger.error("처리 함수가 등록되지 않았다: %s", job_id)
            else:
                _processor(job_id)
        except Exception:
            # 워커가 죽으면 이후 job 이 전부 멈춘다. 무슨 일이 있어도 계속 돈다.
            logger.exception("job 처리 중 예외: %s", job_id)
        finally:
            with _lock:
                if job_id in _pending:
                    _pending.remove(job_id)
            _queue.task_done()


def start_worker() -> None:
    """데몬 스레드 하나를 띄운다. lifespan 에서 호출한다."""
    global _worker
    if _worker is not None and _worker.is_alive():
        return
    _worker = threading.Thread(target=_run, name="face-swap-worker", daemon=True)
    _worker.start()
    logger.info("얼굴 교체 워커 시작")
