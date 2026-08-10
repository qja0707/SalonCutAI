# 프론트엔드 (서비스·UI)

미용실 AI 마케팅 서비스의 클라이언트 웹 앱입니다. Next.js 16 (App Router) + shadcn/ui + Tailwind v4.

**배포본**: http://34.56.138.255:3000/ (dev VM)
`dev` 브랜치에 push되면 `.github/workflows/deploy-dev.yml`이 자동 배포합니다. 배포 이력은 Actions 탭에서 확인합니다.

## 실행 방법

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

- ⚠️ **Node 25에서는 `next dev`가 기동되지 않습니다.** Node LTS(22)를 사용하세요 (CI도 Node 22를 씁니다). `npm run build`와 `next start`는 Node 25에서도 동작합니다.
- 타입 에러(`LayoutProps` 등)가 나면 `npx next typegen`을 먼저 실행하세요. Next 16이 생성하는 라우트 타입이 없어서 나는 에러입니다.

## 검증

```bash
npm run lint && npx tsc --noEmit && npm run verify:mock
```

`verify:mock`은 내부에서 `next start`를 띄우므로 **`npm run build`를 먼저** 해야 합니다. 얼굴 교체 job 흐름·동의 확인·health 회귀를 검사합니다.

⚠️ **프론트만 수정해도 커밋 시 backend pytest가 돕니다** (pre-commit `always_run`). `backend/.env`에 `OPENAI_KEY=placeholder` 한 줄이 있으면 통과합니다 (`backend/README.md` 참고).

## 환경변수

`frontend/.env.local`에 필요 시 설정합니다. **키 값은 저장소에 적지 않습니다.**

| 변수 | 용도 | 없으면 |
|---|---|---|
| `SALON_API_MODE` | `mock`(기본) 또는 `proxy`. **backend 연동 스위치** — `proxy`는 아직 스텁이라 500을 반환 | mock으로 동작 |
| `NEXT_PUBLIC_PUBLIC_PREVIEW` | `1`이면 공개 미리보기 모드 — 사용자 API 키 입력·외부 모델 호출 차단. **인증·HTTPS 없는 공개 배포에서는 반드시 켤 것** | 일반 모드 |
| `OPENAI_API_KEY` | 블로그·문구 생성 (서버에서만 사용) | LLM 기능이 400 에러 |
| `OPENAI_MODEL` | 선택. 기본 `gpt-4o-mini` | 기본값 사용 |
| `GOOGLE_MODEL` | 선택. 기본 `gemini-2.0-flash` | 기본값 사용 |
| `HF_IMAGE_MODEL` | 선택. 기본 SDXL base 1.0 | 기본값 사용 |

참고: 환경변수 이름이 backend(`OPENAI_KEY`)와 프론트(`OPENAI_API_KEY`)가 다릅니다. 통합 시 정리가 필요합니다.

## 화면 구성

**MVP 3기능 (Discussion #23 기준)**

| 라우트 | 기능 | 상태 |
|---|---|---|
| `/face-swap` | ① 얼굴 교체 | job 기반 mock 완성 (접수→폴링→재시도→3규격→삭제). 동의 확인 화면 포함. 실제 모델 연동은 backend 대기 |
| `/generate/blog` | ② 블로그 글 생성 | 프론트 자체 `/api/generate-blog`(OpenAI 직접 호출)로 동작 중. job 기반 전환은 PR #37 진행 중 |
| `/generate/shorts` | ③ AI 숏츠 | 화면 구조만. 생성 방식 협의 중 |

**확장 (MVP 제외 — 코드는 보존)**

`/season-banner`, `/generate/caption`, `/style-consult`, `/sketch-consult`, `/marketing-calendar`, `/generate/image`, `/compare`(팀 내부 모델 비교 도구)

## backend 계약 (2026-08-10 합의 상태)

- **블로그 입력**: backend `BlogGenerationRequest` **12필드가 정본**. 프론트는 프로필 기본값 3 / 필수 4 / 선택(버튼) 5로 나눠 받기로 함 — 상세는 Discussion #44 회신 참고
- **블로그 출력**: `sections: [{heading, body}]` 구조로 확정. backend 반환 모델 수정이 PR #45에서 진행 중
- **동의**: `consent: {agreed, consent_version}`을 job 생성 시 전송. 문구·버전은 `src/lib/consent.ts`가 단일 출처
- mock 계약 레이어는 `src/lib/api-client/`에 있습니다. `SALON_API_MODE=proxy` 분기에 실제 backend 호출을 채우면 연동됩니다

→ PR #37·#45가 머지되기 전에는 `/generate/blog`를 backend API로 갈아끼우지 말아 주세요.

## 기타

- `AGENTS.md` / `CLAUDE.md`는 `next dev`가 자동 생성·갱신하는 파일입니다. 직접 편집하지 마세요.
- 커밋·주석은 팀 `CONTRIBUTING.md` 규칙대로 한국어로 작성합니다.
