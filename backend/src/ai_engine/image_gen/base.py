"""SDXL 파이프라인 로딩·생성·해제 기본 모듈.

STEP 0에서 Colab L4 환경 검증을 거쳐 확정한 코드.
검증 결과: 로딩 28.0초 / 생성 13.4초 / VRAM 최대 10.49GB
(SDXL base 1.0, 1024x1024, 30스텝, seed 고정 시 재현성 확인)
"""

import gc
import time

import torch
from diffusers import AutoPipelineForInpainting, AutoPipelineForText2Image

# 조합마다 파이프라인 종류가 달라 매핑으로 관리
TASK_MAP = {
    "text2img": AutoPipelineForText2Image,
    "inpaint": AutoPipelineForInpainting,
}


def load_pipeline(model_id, task="text2img"):
    """모델을 GPU에 로딩한다.

    Args:
        model_id: HuggingFace 모델 ID
        task: "text2img" 또는 "inpaint"

    Returns:
        (파이프라인, 메타 dict) — 메타에 로딩 시간과 VRAM 사용량 포함
    """
    if task not in TASK_MAP:
        raise ValueError(f"task는 {list(TASK_MAP)} 중 하나여야 합니다: {task}")

    # 직전 모델의 VRAM 최고치가 남아 있으면 측정값이 오염되므로 초기화
    torch.cuda.reset_peak_memory_stats()
    t0 = time.time()

    pipe = (
        TASK_MAP[task]
        .from_pretrained(
            model_id,
            torch_dtype=torch.float16,  # L4에서 fp16으로 VRAM 절반 사용
            variant="fp16",  # fp16 전용 가중치 (제공하지 않는 모델도 있음)
            use_safetensors=True,
        )
        .to("cuda")
    )

    meta = {
        "model_id": model_id,
        "task": task,
        "load_sec": round(time.time() - t0, 1),
        "vram_gb": round(torch.cuda.max_memory_allocated() / 1024**3, 2),
    }
    return pipe, meta


def generate(pipe, prompt, seed=42, negative=None, steps=30, guidance=6.0, **kwargs):
    """이미지를 생성한다.

    Args:
        pipe: load_pipeline이 반환한 파이프라인
        prompt: 생성 프롬프트
        seed: 난수 시드. 동일 환경에서 같은 seed는 같은 결과를 낸다
        negative: 네거티브 프롬프트
        steps: 디노이징 스텝 수
        guidance: 프롬프트 반영 강도
        **kwargs: 인페인팅의 image·mask_image·strength 등 조합별 추가 인자

    Returns:
        (PIL 이미지, 메타 dict) — 메타에 생성 시간과 VRAM 사용량 포함
    """
    torch.cuda.reset_peak_memory_stats()
    generator = torch.Generator(device="cuda").manual_seed(seed)
    t0 = time.time()

    image = pipe(
        prompt=prompt,
        negative_prompt=negative,
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
        **kwargs,
    ).images[0]

    meta = {
        "seed": seed,
        "steps": steps,
        "guidance": guidance,
        "gen_sec": round(time.time() - t0, 1),
        "vram_gb": round(torch.cuda.max_memory_allocated() / 1024**3, 2),
    }
    return image, meta


def release(*objs):
    """GPU 메모리를 해제한다. 모델을 교체하기 전에 반드시 호출한다.

    주의: 호출 전에 호출부에서 `del pipe`를 먼저 실행해야 한다.
    함수 인자로 받은 참조만 삭제해서는 호출부 변수가 남아 해제되지 않는다.

        del pipe
        release()

    Returns:
        해제 후 할당된 VRAM(GB). 0에 가까워야 정상이다.
    """
    for obj in objs:
        del obj
    gc.collect()
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()
    return round(torch.cuda.memory_allocated() / 1024**3, 2)
