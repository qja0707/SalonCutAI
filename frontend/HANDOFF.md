# 프론트엔드 인수인계 노트

> 2026-08-06 · R5 최혜리 (서비스·UI)
> 담당자 부재 시 팀원이 이어받을 수 있도록 현재 상태를 정리한 문서입니다.

## 1. 이게 무엇인가

미용실 AI 마케팅 서비스의 프론트엔드입니다. Next.js 16 (App Router) + shadcn/ui + Tailwind v4.
지금까지 개인 저장소 `twentycherry-gif/AI-SALON` 에서 개발했고, 이 PR로 팀 저장소에 옮깁니다.

**배포본**: https://salon-ai-web-production.up.railway.app/
팀원들이 진행 상황을 확인해 온 주소입니다. 인증이 없습니다.

## 2. 실행 방법

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Node 25 + Next 16 조합에서 `next dev` 와 `tsc` 가 기동되지 않는 현상을 확인했습니다.
안 뜨면 Node LTS(22 등)로 낮춰서 시도해 주세요.

## 3. 환경변수

`frontend/.env.local` 에 아래 값이 필요합니다. **키 값은 이 문서에 적지 않습니다. 최혜리에게 요청하거나 각자 발급해 주세요.**

| 변수 | 용도 | 없으면 |
|---|---|---|
| `OPENAI_API_KEY` | 블로그·문구 생성 (서버에서만 사용) | LLM 기능 4개가 400 에러 |
| `OPENAI_MODEL` | 선택. 기본 `gpt-4o-mini` | 기본값 사용 |
| `HF_IMAGE_MODEL` | 선택. 기본 SDXL base 1.0 | 기본값 사용 |

HuggingFace 키는 환경변수가 아니라 **화면에서 사용자가 직접 입력**하는 구조입니다 (`/face-swap`, `/generate/image`).

⚠️ **Railway 배포는 최혜리 개인 계정에 연결돼 있습니다.** 환경변수 변경·재배포는 팀원이 할 수 없습니다. 배포본에 문제가 생기면 최혜리에게 연락해 주세요.

## 4. 화면 구성

**MVP 핵심 (2026-08-05 확정 범위)**

| 라우트 | 기능 | 상태 |
|---|---|---|
| `/face-swap` | 기능 ① 얼굴 교체 | HuggingFace `imageToImage` 실제 연동. **얼굴 마스킹 전이라 사진 전체가 변환됨** |
| `/generate/blog` | 기능 ② 블로그 글 생성 | OpenAI 실제 연동. 단 백엔드 계약과 스키마 불일치 (아래 6번) |

**확장 (MVP 제외 — 코드는 보존)**

`/season-banner`, `/generate/caption`, `/style-consult`, `/sketch-consult`, `/marketing-calendar`, `/generate/image`, `/compare`(팀 내부 모델 비교 도구)

## 5. 미구현 항목

- **고객 동의 확인 단계** — MVP 정의상 필수인데 UI에 없음. 핵심 흐름 1단계
- **처리 상태 4종** (`queued`/`processing`/`completed`/`failed`) — 현재는 `generating` boolean 하나뿐, `job_id` 개념 없음
- **얼굴 교체 3규격 출력** — 현재 출력 비율이 3택1 라디오. MVP는 1:1·4:5·9:16 전부 생성해야 함
- **얼굴 마스킹** — R2(노수민) 의존. 붙으면 `image_to_image` → inpainting 호출로 교체 필요 (`api/generate-image/route.ts` 의 TODO 참고)
- **mock 클라이언트 레이어** — 계약 확정 후 작업 예정

## 6. 백엔드와의 계약 불일치 (인계받으면 먼저 확인할 것)

블로그 기능이 프론트 / 백엔드(`dev`) / 회의 MVP 정의 **3자가 모두 다릅니다.**

**요청**: 프론트는 `topic, theme, tone, domainContext` 자유 텍스트 4개 / 백엔드 `BlogGenerationRequest` 는 `hair_length` 등 **구조화 12필드 전부 필수**. 겹치는 필드가 없습니다.

**응답**: 프론트는 `sections[{heading, body}]` 배열을 map 으로 렌더링 / 백엔드는 `body` **단일 문자열**에 소제목이 `[1. …]` 대괄호로 임베드. 그대로는 붙지 않습니다.

→ 이 결정이 나기 전에는 `/generate/blog` 를 백엔드 API로 갈아끼우지 말아 주세요. 현재 프론트 자체 `/api/generate-blog` 로 동작 중입니다.

상세 대조표와 제안안은 최혜리가 작성한 `20260806_최혜리_API계약_필드목록_mock연결_화면흐름.md` 에 있습니다.

## 7. 기타 참고

- 환경변수 이름이 백엔드(`OPENAI_KEY`)와 프론트(`OPENAI_API_KEY`)가 다릅니다. 통합 시 정리 필요.
- `AGENTS.md` / `CLAUDE.md` 는 `next dev` 가 자동 생성·갱신하는 파일입니다. 직접 편집하지 마세요.
- 커밋·주석은 팀 `CONTRIBUTING.md` 규칙대로 한국어로 작성합니다.
