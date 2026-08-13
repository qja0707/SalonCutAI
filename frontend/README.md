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

⚠️ **프론트만 수정해도 커밋 시 backend pytest가 돕니다.** 훅 구성과 설치 방법은 루트 `CONTRIBUTING.md`가 정본입니다(PR #78). 여기서는 프론트 쪽에서 걸리는 부분만 적습니다 — `backend/.env`가 없으면 pytest가 실패하므로 아래처럼 만들고 `OPENAI_KEY`에 아무 값(`placeholder` 등)이나 채우면 통과합니다. 테스트가 `@patch`로 모킹하므로 실제 키는 필요 없습니다.

```bash
cd backend && cp .env.example .env
```

## 환경변수

`frontend/.env.local`에 필요 시 설정합니다. **키 값은 저장소에 적지 않습니다.**

| 변수 | 용도 | 없으면 |
|---|---|---|
| `SALON_API_MODE` | `mock`(기본) 또는 `proxy`. **backend 연동 스위치** — `proxy`면 `/api/v1/*` 요청을 `BACKEND_API_URL`로 그대로 넘깁니다 (PR #70) | mock으로 동작 |
| `BACKEND_API_URL` | `proxy` 모드에서 요청을 넘길 backend 주소. **`SALON_API_MODE=proxy`면 필수** | `undefined`가 URL에 들어가 fetch가 실패하고 500을 반환 |
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
| `/face-swap` | ① 얼굴 교체 | job 기반 mock 완성 (접수→폴링→재시도→3규격→삭제). 동의 확인 화면, 얼굴 옵션 7축(PR #77), 결과물 AI 생성 배지·규격 쓰임새 병기(PR #75) 포함. 실제 모델 연동은 backend 대기 |
| `/generate/blog` | ② 블로그 글 생성 | job 기반 mock 완성 (접수→폴링→재시도→삭제). 12필드 입력 폼·매장 프로필 쿠키 포함. 실제 모델 연동은 backend 대기 |
| `/generate/shorts` | ③ AI 숏츠 | MVP 설계 확정. 역할 기반 편집 엔진 구현 착수, 화면·API 연결 전 |

**공통**

`/user/signin` — 로그인 화면 (PR #76). 사이드바·모바일 헤더의 로그인 버튼에서 진입합니다.

**확장 (MVP 제외 — 코드는 보존)**

`/season-banner`, `/generate/caption`, `/style-consult`, `/sketch-consult`, `/marketing-calendar`, `/generate/image`, `/compare`(팀 내부 모델 비교 도구)

## backend 계약 (2026-08-13 기준 · dev `f9c2db6`)

- **블로그 입력**: backend `BlogGenerationRequest` **12필드가 정본**.
  프론트 입력 UX 분류(프로필 기본값 / 필수 4개 / 선택 6개)는 Discussion #44 회신을 근거로 PR #56에서 구현했습니다. 선택 필드는 미입력 시 빈 문자열로 전송합니다. **`special_product` 처리는 PM 최종 확정 대기 상태**라, 관련 동작을 바꿀 때는 확인이 필요합니다
- **블로그 출력**: backend는 **고정 키 객체** `sections: {before, process, after, home_care}`이고 각 값이 `{heading, body}`입니다. 프론트 화면은 배열을 유지하고, 변환은 api-client 응답 처리에서 `[before, process, after, home_care]` 순서로 합니다(`src/lib/api-client/types.ts`의 `BLOG_SECTION_ORDER`). backend 반환 모델(PR #45)과 프론트 어댑터(PR #37) 모두 머지 완료
- **동의**: `consent: {agreed, consent_version}`을 job 생성 시 전송. 문구·버전은 `src/lib/consent.ts`가 단일 출처
- mock 계약 레이어는 `src/lib/api-client/`에 있습니다. `SALON_API_MODE=proxy` 분기는 PR #70에서 채워졌습니다 — `src/lib/api-client/server/response.ts`의 `proxyPendingResponse()`가 `BACKEND_API_URL`로 요청을 그대로 넘깁니다

→ `/api/generate-blog`(OpenAI 직접 호출) 라우트는 남아 있지만 화면에서는 쓰지 않습니다. 제거 시점은 별도로 정합니다.

## 기타

- `AGENTS.md` / `CLAUDE.md`는 `next dev`가 자동 생성·갱신하는 파일입니다. 직접 편집하지 마세요.
- 커밋·주석은 팀 `CONTRIBUTING.md` 규칙대로 한국어로 작성합니다.
