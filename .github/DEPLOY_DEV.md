# dev 브랜치 GCP VM 자동 배포

`dev`에 프론트엔드 또는 백엔드 변경이 반영되면 GitHub Actions가 검증을 마친 뒤 GCP VM의 `/opt/salon-web/repo`를 같은 커밋으로 동기화합니다.

## 현재 자동화 범위

- 프론트엔드: `npm ci`(잠금 파일 변경 시), 빌드, `salon-web` 재시작, `127.0.0.1:3000` 상태 확인
- 백엔드: 소스 동기화 및 Python 문법 검사
- 백엔드 재시작: `/api/v1/health`와 `salon-api.service` 계약이 확정될 때까지 보류

## GitHub에 필요한 저장소 변수

Repository `Settings → Secrets and variables → Actions → Variables`에 다음 두 값을 등록합니다.

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: Workload Identity Provider 전체 리소스 이름
- `GCP_DEPLOY_SERVICE_ACCOUNT`: 배포 서비스 계정 이메일

두 변수가 없으면 검증 작업만 실행되고 VM 배포 작업은 안전하게 건너뜁니다.

## GCP 1회 설정 원칙

1. GitHub Actions용 Workload Identity Pool/Provider를 만듭니다.
2. Provider는 `qja0707/SalonCutAI` 저장소와 `refs/heads/dev` 브랜치에서 온 요청만 허용하도록 조건을 제한합니다.
3. 배포 서비스 계정에는 대상 VM 접근에 필요한 최소 권한만 부여합니다.
4. VM의 OS Login을 사용하고, 서비스 계정에는 관리자 SSH 로그인을 위한 `roles/compute.osAdminLogin`을 대상 프로젝트 또는 VM 범위로 부여합니다.
5. 장기 JSON 서비스 계정 키나 고정 SSH 개인키는 GitHub에 저장하지 않습니다.

VM의 `salon-web` 서비스 재시작, `/opt/salon-web/repo` 소유자 권한 실행을 위해 배포 계정은 비대화형 `sudo`를 사용할 수 있어야 합니다. 운영 전 별도 테스트 브랜치가 아닌 `workflow_dispatch`로 검증한 뒤 `dev` 자동 실행을 사용합니다.

