# backend

## how to run
### local (test 용도)
```bash
uv run uvicorn src.main:app --reload
```

## colab 에서 패키지 설치
```bash
!uv pip install -e . --system
```

## TEST
```bash
uv run python -m pytest
```