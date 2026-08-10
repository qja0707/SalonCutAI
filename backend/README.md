# backend

## 개발환경 세팅
### 패키지 설치
```bash
uv sync
```

### 환경설정 세팅
```bash
cp .env.example .env

# 이후 .env 파일에 적절한 값으로 수정
```

### git hook 등록 (필수)
```bash
uv run pre-commit install
```

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