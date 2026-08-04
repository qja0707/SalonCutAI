# hair-salon-ai

## Project Structure

```
hair-salon-ai/                   # [루트] 프로젝트 레포지토리
├── .gitignore
├── README.md
├── CONTRIBUTING.md
│
├── frontend/                    # 1️⃣ [FE] 웹 UI (Streamlit 등)
│
└── backend/                     # 2️⃣ [BE] API 서버, 비즈니스 로직, AI 엔진
    ├── api/                     # FE와 통신하는 REST API 라우터
    └── ai-engine/               # 3️⃣ [AI] 추론 파이프라인, 모델 관리 & 실험 공간
        ├── image_gen/           # [이미지 생성 파트]
        ├── text_gen/            # [텍스트/마케팅 파트]
        ├── metrics/             # [평가 파트]
        └── notebooks/           # [실험 공간]
```
