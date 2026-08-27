# SalonCutAI

미용실을 위한 AI 마케팅 콘텐츠 서비스입니다. 시술 사진과 영상을 올리면 검토 후 바로 활용할 수 있는 홍보 콘텐츠 초안을 만들어 줍니다.

**라이브 데모**: https://saloncut-ai.duckdns.org (프로젝트 운영 기간 동안 열려 있습니다)

## 무엇을 하나요

미용실 홍보의 세 가지 걸림돌을 기능 하나씩으로 풉니다.

| 걸림돌 | 기능 | 결과물 |
|---|---|---|
| 고객 얼굴 때문에 시술 사진을 못 올린다 | **헤어 모델 만들기** (`/face-swap`) | 얼굴을 가상 인물로 바꾼 홍보 사진, 채널별 3규격 |
| 블로그 글쓰기는 품이 많이 든다 | **간단 블로그 글쓰기** (`/generate/blog`) | 시술 정보 입력 → 검색 키워드를 반영한 블로그 글 |
| 영상 편집을 배워야 한다 | **간편 숏츠 만들기** (`/generate/shorts`) | 시술 영상 → 자막·얼굴 블러 포함 9:16 숏폼 |

<!-- 화면 캡처: docs/assets/readme/ 에 추가 예정 -->

## 어떻게 동작하나요

- 화면에서 보낸 요청은 백엔드가 기능별 처리 경로로 전달합니다. 얼굴 변경은 단일 GPU 워커 큐가 순차 처리하고, 숏폼은 별도 작업으로 접수해 CPU 인코더 한 개씩 처리합니다. 블로그는 작성과 검수를 한 요청에서 연속 실행합니다.
- **얼굴 변경**은 두 모드입니다. 참조 얼굴 모드(가상 인물 53명 중 선택)는 서버에 올린 로컬 AI 모델이 처리합니다. 프롬프트 모드(스타일 문장 지정)는 원본 전체 대신 얼굴 중심 크롭(주변 여백 포함)과 편집 마스크를 OpenAI 이미지 편집 API로 전송해 처리합니다.
- **블로그 글**은 작성 모델이 쓴 글을 상위 검수 모델이 사실 모순만 고치는 2단계로 생성합니다.
- **숏폼**은 사용자가 업로드한 영상을 FFmpeg로 역할과 구간에 맞게 잘라 이어 붙이고, AI 자막과 얼굴 블러를 적용합니다. 영상 2개만 올리면 기본값으로 초안이 자동 생성됩니다.
- 운영: GCP L4 GPU VM 1대, HTTPS(Caddy), `dev` 병합 시 5분 주기 타이머가 검사 통과를 확인하고 바뀐 영역만 자동 배포합니다. 배포 실패는 저장소 이슈로 자동 보고됩니다.

## 기술 스택

- 프론트엔드: Next.js, TypeScript
- 백엔드: FastAPI, Python
- AI: Stable Diffusion 계열 얼굴 변경 파이프라인(GPU), OpenAI API(이미지 편집·텍스트 생성·검수), FFmpeg 영상 파이프라인
- 인프라: GCP(L4 GPU VM), Caddy, systemd 타이머 기반 자동 배포

## 직접 실행해 보기

백엔드 없이 화면 흐름만 보려면 프론트엔드만 띄우면 됩니다. API 모드를 지정하지 않으면 mock으로 동작합니다.

```bash
cd frontend
npm install
npm run dev
```

전체 실행(백엔드·모델 포함)과 환경변수 목록은 각 폴더 문서를 따르세요. 환경변수는 이름만 문서화하며 값은 저장소에 두지 않습니다.

- [frontend/README.md](./frontend/README.md)
- [backend/README.md](./backend/README.md)

## 검증

- 백엔드: pytest(엔진·API), ruff
- 프론트엔드: lint, production build, `verify:mock`(빌드본에서 접수→폴링→결과 회귀 확인)
- 병합 전 검증: PR마다 최신 `dev`와 결합한 격리 환경에서 빌드·테스트·실제 동작을 재현한 뒤 병합했습니다

## 사용자 테스트

현직 미용인 4명과 진행했습니다. 1차(8/18~19)에서 사용 흐름과 업로드가 막힌다는 결과를 받아 원인을 규명해 고쳤고(자동 초안·화면 3단계 개편·아이폰 사파리 업로드 수정), 8/28 같은 참가자 재테스트를 진행해 개선 전후를 확인할 예정입니다. 과정과 수치는 최종 보고서에 있습니다.

## 팀

| 이름 | 역할 |
|---|---|
| 노승원 | 팀장 · PM · 서빙 인프라 · 숏폼 영상 |
| 노수민 | 이미지 생성 모델 (얼굴 변경) |
| 박규범 | 블로그 글 생성 · 백엔드 기반 · 인증 · 저장소 운영 |
| 최혜리 | 서비스 화면 전체 |

## 알려진 한계

- 얼굴 블러는 면적이 가장 큰 한 명에게만 자동 적용됩니다 (화면에서 안내)
- 블로그 검수는 준비된 10개 시나리오 밖의 입력 조합에서 품질을 보장하지 않습니다
- 숏폼 작업 상태와 임시 파일은 서버 프로세스·임시 저장소에 있어 재시작 시 진행 중 작업이 유실됩니다. 얼굴 변경 작업은 상태를 DB에 보관하지만 재시작으로 중단되면 재시도가 필요합니다
- GPU가 1장이라 서비스와 검증이 자원을 공유합니다

## 문서

- **최종 보고서**: 제출 시 이 자리에 파일이 첨부됩니다 <!-- docs/ 경로 확정 후 링크 -->
- **협업일지** (GitHub Discussions):
  [노승원](https://github.com/qja0707/SalonCutAI/discussions?discussions_q=author%3Aynow98+%ED%98%91%EC%97%85%EC%9D%BC%EC%A7%80) ·
  [박규범](https://github.com/qja0707/SalonCutAI/discussions?discussions_q=author%3Aqja0707+%ED%98%91%EC%97%85%EC%9D%BC%EC%A7%80) ·
  [최혜리](https://github.com/qja0707/SalonCutAI/discussions?discussions_q=author%3Atwentycherry-gif+%ED%98%91%EC%97%85%EC%9D%BC%EC%A7%80) ·
  [노수민](https://github.com/qja0707/SalonCutAI/discussions?discussions_q=author%3ARosoomin+%ED%98%91%EC%97%85%EC%9D%BC%EC%A7%80)
- 파트 보고서: [블로그 글 생성](https://github.com/qja0707/SalonCutAI/discussions/202) · [숏폼·서빙 인프라·PM](https://github.com/qja0707/SalonCutAI/discussions/203) · [서비스·UI](https://github.com/qja0707/SalonCutAI/discussions/205) <!-- 이미지 파트 도착 시 추가 -->

## 저장소 구조

```
SalonCutAI/
├── frontend/            # Next.js 웹 앱 (화면·mock 계약 레이어)
├── backend/
│   └── src/
│       ├── api/         # REST API 라우터
│       └── ai_engine/   # 이미지·텍스트·영상 파이프라인, 평가, 실험
└── .github/             # 배포 스크립트·운영 문서
```
