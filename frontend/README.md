# 프론트엔드 (서비스·UI)

미용실 AI 마케팅 서비스의 클라이언트 웹 앱입니다. Next.js 16 (App Router) + shadcn/ui + Tailwind v4.

**배포본**: http://34.56.138.255:3000/ (dev VM)
`dev` push 시 `.github/workflows/deploy-dev.yml`의 frontend·backend 검사는 자동 실행되고, **GCP VM 반영은 WIF·IAM 설정 후에만 동작하며 현재는 수동 배포**입니다. 실행 이력은 Actions 탭에서 확인합니다.

## 실행 방법

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

- ⚠️ **팀 환경에서 Node 25 + Next 16 조합은 `next dev`가 기동되지 않는 것을 확인했습니다.** Node LTS(22)를 사용하세요 (CI도 Node 22를 씁니다). `npm run build`와 `next start`는 Node 25에서도 동작합니다.
- 타입 에러(`LayoutProps` 등)가 나면 `npx next typegen`을 먼저 실행하세요. Next 16이 생성하는 라우트 타입이 없어서 나는 에러입니다.

## 검증

```bash
npx next typegen && npm run lint && npx tsc --noEmit && npm run build && npm run verify:mock
```

**앞의 두 단계는 순서가 중요합니다.** 깨끗한 체크아웃에는 `.next`가 없어서, `next typegen` 없이 `tsc`를 돌리면 `LayoutProps`를 찾지 못해 실패합니다. 그리고 `verify:mock`은 내부에서 `next start`만 띄우고 빌드는 하지 않으므로, `npm run build`가 없으면 404가 납니다. 검사 범위는 얼굴 교체 job 흐름·동의 확인·health 회귀입니다.

⚠️ **프론트만 수정해도 커밋 시 backend pytest가 돕니다** (pre-commit `always_run`). `backend/.env`가 없으면 아래처럼 만들고 `OPENAI_KEY`에 아무 값(`placeholder` 등)이나 채우면 통과합니다. 테스트가 `@patch`로 모킹하므로 실제 키는 필요 없습니다.

```bash
cd backend && cp .env.example .env
```

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
| `/generate/shorts` | ③ AI 숏츠 | MVP 설계 확정. 역할 기반 편집 엔진 구현 착수, 화면·API 연결 전 |

**확장 (MVP 제외 — 코드는 보존)**

`/season-banner`, `/generate/caption`, `/style-consult`, `/sketch-consult`, `/marketing-calendar`, `/generate/image`, `/compare`(팀 내부 모델 비교 도구)

## backend 계약 (2026-08-11 기준)

- **블로그 입력**: backend `BlogGenerationRequest` **12필드가 정본**.
  프론트 입력 UX 분류(프로필 기본값 / 필수 / 선택 버튼)는 Discussion #44에서 논의 중이며 **확정 전입니다 — 이 분류대로 폼을 만들지 마세요.** 선택 필드 미입력 전송 규칙과 `special_product` 처리는 담당자 회신이 모였고 PM 최종 확정 대기 상태입니다
- **블로그 출력**: backend는 **고정 키 객체** `sections: {before, process, after, home_care}`이고 각 값이 `{heading, body}`입니다. 프론트 화면은 배열을 유지하고, 변환은 api-client 응답 처리에서 `[before, process, after, home_care]` 순서로 합니다. backend 반환 모델은 PR #45, 프론트 어댑터는 PR #37에서 진행 중
- **동의**: `consent: {agreed, consent_version}`을 job 생성 시 전송. 문구·버전은 `src/lib/consent.ts`가 단일 출처
- mock 계약 레이어는 `src/lib/api-client/`에 있습니다. `SALON_API_MODE=proxy` 분기에 실제 backend 호출을 채우면 연동됩니다

→ PR #37·#45가 머지되기 전에는 `/generate/blog`를 backend API로 갈아끼우지 말아 주세요.

## 기타

- `AGENTS.md` / `CLAUDE.md`는 `next dev`가 자동 생성·갱신하는 파일입니다. 직접 편집하지 마세요.
- 커밋·주석은 팀 `CONTRIBUTING.md` 규칙대로 한국어로 작성합니다.
