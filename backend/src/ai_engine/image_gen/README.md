# image_gen - 얼굴 교체 이미지 생성

손님 사진의 얼굴만 바꾸고 헤어·의상·배경은 원본을 유지한다. 두 모드가 있고 후처리 방식이 다르다.

| 모드 | 엔진 | 핵심 | 장당 시간 | GPU |
|---|---|---|---|---|
| 참조 얼굴 모드(`reference`) | InstantID + RealVisXL img2img | 미리 만든 가상 얼굴(`ref-01`~`ref-53`)의 정체성을 입힌다 | 약 30초 | L4 |
| 프롬프트 모드(`prompt`) | OpenAI `images.edit` gpt-image-2 (기본) | 국적·성별·연령·동물상·표정·메이크업 옵션을 문장으로 만들어 얼굴만 다시 그린다 | 29~39초 (API 편차) | 없음 |

프롬프트 모드는 `PROMPT_MODE_ENGINE=sdxl` 로 SDXL 인페인팅 경로로 되돌릴 수 있다. SDXL 은 동물상 같은 인상 개념이 반영되지 않아 GPT 편집으로 바꿨다.

## 파일

| 파일 | 역할 |
|---|---|
| `pipeline.py` | `run(job_id, options, seed)`. 모드 분기 → 후처리 → 비율 3종 저장. service 가 여기만 부른다 |
| `job_queue.py` | 단일 워커 스레드. 두 파이프라인 동시 상주 시 VRAM 여유가 없어 1개 |
| `loader.py` | 모델 상주(싱글턴). `warmup()` 은 기동 시 백그라운드에서 호출. 엔진 gpt 면 SDXL 인페인팅은 올리지 않는다 |
| `downloads.py` | 모델 파일 확보(약 4.6GB, git 미포함). 없으면 기동 시 받는다 |
| `settings.py` | 확정값 전부. 값마다 근거 주석이 있다 |
| `validate.py` | 사전 검증. 얼굴 없음 / 여러 명 / 얼굴 폭 < `MIN_FACE_WIDTH`(2048 저장본 기준) |
| `storage.py` | 저장본(긴 변 2048)·결과·참조 경로 |
| `combo3.py` | 참조 얼굴 모드 생성 (긴 변 1024) |
| `combo5_gpt.py` | 프롬프트 모드 생성 - 얼굴 크롭 → OpenAI 편집 → 되붙임 |
| `combo5.py` | 프롬프트 모드 SDXL 경로 (fallback) |
| `prompt_map.py` | 옵션 → 프롬프트. GPT 경로는 `build_face_sentence`, SDXL 경로는 `build_face_prompt` |
| `masks.py` | 얼굴 윤곽·헤어·눈썹·피부 마스크 (MediaPipe) |
| `compose.py` | 색 정합·재합성·눈썹 보존. `align_then_recompose`·`transfer_high_freq` 는 파이프라인에서 제거됐고 함수만 남아 있다 |
| `restore.py` | CodeFormer 복원 (CPU). 참조 얼굴 모드만 |
| `aspect.py` | 1:1 / 4:5 / 9:16 변환 |
| `base.py` | SDXL 로딩·생성 공통 (실험 노트북과 공유) |
| `vendor/` | InstantID 파이프라인, CodeFormer arch, `draw_kps`. 원본 그대로, ruff 제외 |

## 흐름

### 참조 얼굴 모드

```
validate → combo3.generate (긴 변 1024, 파라미터는 settings.py)
→ 저장본(2048) 크기로 올려 후처리
   색 정합 → recompose_with_hair (얼굴 안 = 생성, 밖 = 원본, 헤어 = 원본)
   → 눈썹 보존 → CodeFormer 복원 → 색 정합(마스크 안만) → 눈썹 보존
→ 비율 3종
```

눈썹 보존이 두 번인 이유: 복원이 정렬 영역 전체를 다시 그려 눈썹도 덮으므로 복원 뒤에 원본 눈썹을 되돌려야 하고, 복원 전에도 한 번 되돌리는 것은 CodeFormer 가 입력을 보고 그리므로 원본 눈썹이 있는 상태가 형태 유지에 낫기 때문이다.

### 프롬프트 모드 (GPT)

```
얼굴 bbox 기준 정사각 크롭 → 1024
편집 마스크 = 얼굴 윤곽 확장 - 헤어 → RGBA 알파
images.edit → 원본 자리에 페더링 되붙임
색 정합(약하게) → recompose_skin (피부 클래스 안 = GPT, 배경·옷·머리 = 원본)
→ 비율 3종
```

복원·눈썹 보존은 하지 않는다. 사진 전체가 아니라 얼굴 크롭만 OpenAI 로 전송된다. 시드가 없어 같은 입력도 호출마다 다른 얼굴이 나온다.

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `IMAGE_GEN_ENABLED` | `0` | `1` 이면 모델을 올린다. 로컬·pytest 는 `0` (더미 이미지) |
| `PROMPT_MODE_ENGINE` | `gpt` | `sdxl` 이면 SDXL 인페인팅 경로 |
| `GPT_IMAGE_MODEL` | `gpt-image-2` | |
| `OPENAI_KEY` | | text_gen 과 같은 키 |
| `SALON_STORAGE_DIR` | `<레포 상위>/storage` | 저장본·결과. 레포 밖 |
| `SALON_MODELS_DIR` | `<STORAGE_DIR>/models` | 모델 파일 |

## 실행

서버 기동(`src.main`)이 워커를 띄우고 `loader.warmup()` 을 백그라운드 스레드로 부른다. 첫 기동은 모델 다운로드 + 로딩으로 수 분 걸린다.

```bash
IMAGE_GEN_ENABLED=1 uv run uvicorn src.main:app
```

Colab 에서 파이프라인만 돌릴 때:

```python
from src.ai_engine.image_gen import loader, pipeline
loader.warmup()
pipeline.run(job_id, options, seed)
```

## 테스트

```bash
uv run python -m pytest tests/ai_engine/image_gen
```

프롬프트 · 마스크 · GPT 경로 테스트. OpenAI·InsightFace·MediaPipe 는 monkeypatch 라 GPU·키 없이 돈다.

## 실험 노트북

`src/ai_engine/notebooks/` 에 실험 노트북이 있다. 확정값과 판단 근거는 최종 보고서에 정리했다.