# 프론트엔드 (서비스·UI)

미용실 AI 마케팅 서비스의 클라이언트 웹 앱입니다. Next.js 16 (App Router) + shadcn/ui + Tailwind v4.

**배포본**: http://34.56.138.255:3000/ (dev VM)
`dev` 에 병합되면 **VM 의 pull timer 가 자동으로 반영**합니다 — `.github/scripts/pull-deploy-dev.sh` 가 VM(`/opt/salon-web/repo`)에서 `origin/dev` 를 주기적으로 fetch 하고, 필수 검사가 success 인 것을 확인한 뒤 배포·재시작합니다. **문서만 바꾸는 PR 도 병합되면 서비스가 재시작되므로**, 테스트 기간에는 병합 시점을 확인하고 진행합니다.
`deploy-dev.yml` 의 frontend·backend 검사는 push 시 자동 실행됩니다. 같은 워크플로의 `GCP VM 반영` job 은 WIF 변수가 설정된 경우에만 도는 별도 경로이고 현재는 skipped 입니다 — **운영 정본은 위의 pull timer 입니다.** 실행 이력은 Actions 탭에서 확인합니다.

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

화면 대제목과 메뉴 이름이 다릅니다 — 메뉴는 `AI 000` 형태를 쓰고 대제목만 새 이름을 씁니다 (PR #112).

**MVP 3기능 (Discussion #23 기준)**

| 라우트 | 메뉴 이름 / 화면 대제목 | 상태 |
|---|---|---|
| `/face-swap` | AI 모델로 얼굴 변경 / **헤어 모델 만들기** | job 기반 mock 완성 (접수→폴링→재시도→3규격→삭제). 동의 확인, 얼굴 옵션 7축(#77), AI 생성 배지·규격 쓰임새(#75), 결과 흐름 개편(#105 — 겹쳐 가르는 슬라이더·대기 3단계 안내·폰 하단 고정 CTA·같은 설정으로 다음 사진), 복구·교체 시 사진 짝 잠금(#109). **공개 경로에서 실제 연동 검증 완료** |
| `/generate/blog` | AI 블로그 글쓰기 / **간단 블로그 글쓰기** | 동기 생성 완성 (`/api/v1/text-gen/blog-generation` 한 번 호출로 결과를 바로 받습니다 — job·폴링 아님). 12필드 입력 폼·매장 프로필 쿠키·시술 키워드와 고민 칩(#115)·서식 포함 복사(#99). **공개 경로에서 실제 연동 검증 완료** |
| `/generate/shorts` | AI 숏츠 만들기 / **간편 숏츠 만들기** | **backend 연결 완료** — `/api/v1/video-jobs`(#68)로 접수→폴링→9:16 재생·다운로드까지 동작합니다. 클립 2~8개·역할(시술 전/과정/디테일/마무리)·사용 구간·자막(AI 자막 생성 포함)·얼굴 자동 블러·24시간 TTL. 폰 동선 다듬기(#110) |

**공통**

| 라우트·파일 | 내용 |
|---|---|
| `/` | 랜딩 홈 (#111·#112) — 혜택 중심 카피, 실제 결과물 히어로, Before/After 슬라이더 |
| `/user/signin` | 로그인 화면 (#76). 데스크톱은 우상단 상단 바, 폰은 모바일 헤더의 로그인 버튼에서 진입합니다 (#124) |
| `app/error.tsx` · `app/not-found.tsx` | 전역 오류·404 화면 (#113). 없으면 Next 기본 영문 화면이 나옵니다. **이 Next 버전의 error 경계 prop은 `reset`이 아니라 `retry`입니다** |
| `components/theme-provider.tsx` | 화면 색 6종 + 기기 설정 따라가기 (#103). 토스 블루 / 토스 블루 다크 / 따뜻한 아이보리 / 밝은 아이보리 / 차콜 / 미드나잇. 목록은 `THEME_OPTIONS`가 단일 출처 |

**확장 (MVP 제외 — 코드는 보존)**

`/season-banner`, `/generate/caption`, `/style-consult`, `/sketch-consult`, `/marketing-calendar`, `/generate/image`, `/compare`(팀 내부 모델 비교 도구)

## backend 계약 (2026-08-20 기준 · dev `a46b27e`)

- **블로그 입력**: backend `BlogGenerationRequest` **12필드가 정본**.
  프론트 입력 UX 분류(프로필 기본값 / 필수 4개 / 선택 6개)는 Discussion #44 회신을 근거로 PR #56에서 구현했습니다. 선택 필드는 미입력 시 빈 문자열로 전송합니다. `special_product` 는 8/11 에 수렴이 끝났고, 폼 입력(`blog-fields.tsx`)과 프롬프트 사용(`blog_prompt.py`)이 모두 구현돼 있습니다
- **블로그 출력**: backend는 **고정 키 객체** `sections: {before, process, after, home_care}`이고 각 값이 `{heading, body}`입니다. 프론트 화면은 배열을 유지하고, 변환은 api-client 응답 처리에서 `[before, process, after, home_care]` 순서로 합니다(`src/lib/api-client/types.ts`의 `BLOG_SECTION_ORDER`). backend 반환 모델(PR #45)과 프론트 어댑터(PR #37) 모두 머지 완료
- **동의**: `consent: {agreed, consent_version}`을 job 생성 시 전송. 문구·버전은 `src/lib/consent.ts`가 단일 출처
- **인증**: 기능 API 전부에 액세스 토큰 검증이 걸려 있습니다 (#127). 공개로 남은 것은 `auth`·`users`·`health` 뿐입니다. 프록시가 쿠키의 `accessToken` 을 `Authorization` 헤더로 바꿔 전달하므로 `<img src>` 처럼 헤더를 못 싣는 요청도 동작합니다
- **영상(숏츠)**: `/api/v1/video-jobs`(#68). `multipart/form-data`로 클립 2~8개와 옵션(역할·사용 구간·자막)을 올리고 job_id 로 폴링합니다. **얼굴 자동 블러는 고정**이고 결과는 9:16, 24시간 TTL. job 저장이 서버 프로세스 메모리라 **서버가 재시작되면 진행 중이던 작업은 사라집니다**
- mock 계약 레이어는 `src/lib/api-client/`에 있습니다. `SALON_API_MODE=proxy` 분기는 PR #70에서 채워졌습니다 — `src/lib/api-client/server/response.ts`의 `proxyPendingResponse()`가 `BACKEND_API_URL`로 요청을 그대로 넘깁니다

→ `/api/generate-blog`(OpenAI 직접 호출) 라우트는 남아 있지만 화면에서는 쓰지 않습니다. 제거 시점은 별도로 정합니다.

## 기타

- `AGENTS.md` / `CLAUDE.md`는 `next dev`가 자동 생성·갱신하는 파일입니다. 직접 편집하지 마세요.
- 커밋·주석은 팀 `CONTRIBUTING.md` 규칙대로 한국어로 작성합니다.
