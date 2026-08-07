# dev 브랜치 GCP VM 자동 배포

`dev`에 프론트엔드 또는 백엔드 변경이 반영되면 GitHub Actions가 검증을 마친 뒤 GCP VM의 `/opt/salon-web/repo`를 같은 커밋으로 동기화합니다.

## 현재 자동화 범위

- 프론트엔드: `npm ci`(잠금 파일 변경 시), 공개 미리보기 모드 빌드, `salon-web` 재시작, `127.0.0.1:3000` 상태 확인
- 백엔드: 소스 동기화 및 Python 문법 검사
- 백엔드 재시작: `/api/v1/health`와 `salon-api.service` 계약이 확정될 때까지 보류
- 실패 복구: 빌드·재시작·상태 확인 실패 시 소스와 `.next`를 직전 커밋으로 되돌림
- 환경파일: 자동 배포는 `.env.local`·`.env.production.local` 등 `.env*` 파일을 수정하지 않음

## GitHub에 필요한 저장소 변수

Repository `Settings → Secrets and variables → Actions → Variables`에 다음 두 값을 등록합니다.

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: Workload Identity Provider 전체 리소스 이름
- `GCP_DEPLOY_SERVICE_ACCOUNT`: 배포 서비스 계정 이메일

두 변수가 없으면 검증 작업만 실행되고 VM 배포 작업은 안전하게 건너뜁니다.

## GCP 1회 설정 원칙

1. GitHub Actions용 Workload Identity Pool/Provider를 만듭니다.
2. Provider는 `qja0707/SalonCutAI` 저장소와 `refs/heads/dev` 브랜치에서 온 요청만 허용하도록 조건을 제한합니다. 가능하면 재사용될 수 없는 숫자형 `repository_id`와 `repository_owner_id`도 함께 확인합니다.
3. 배포 서비스 계정에는 대상 VM 접근에 필요한 최소 권한만 부여합니다.
4. VM의 OS Login을 사용하고, 서비스 계정에는 일반 로그인을 위한 `roles/compute.osLogin`을 대상 VM 범위로 부여합니다. `roles/compute.osAdminLogin`은 VM 전체 sudo 권한이므로 사용하지 않습니다.
5. 장기 JSON 서비스 계정 키나 고정 SSH 개인키는 GitHub에 저장하지 않습니다.

WIF Provider의 최소 조건은 다음 의미를 가져야 합니다.

```text
assertion.repository == 'qja0707/SalonCutAI' &&
assertion.ref == 'refs/heads/dev'
```

이 조건을 생략하면 저장소에 브랜치를 푸시하고 Actions를 실행할 수 있는 사람이 임의 브랜치의 배포 스크립트로 VM 명령을 실행할 수 있습니다. 조건이 정상이라면 `dev`가 아닌 브랜치에서 `workflow_dispatch`를 실행했을 때 GCP 인증이 거부되는 것이 의도된 동작입니다.

WIF를 서비스 계정 경유 방식으로 구성할 때는 제한된 GitHub principal에 해당 서비스 계정의 `roles/iam.workloadIdentityUser`를 부여합니다. 대상 VM에 서비스 계정이 연결되어 있다면 Google 공식 OS Login 요구사항에 따라 그 서비스 계정에 대한 `roles/iam.serviceAccountUser`도 필요할 수 있습니다.

## VM 사용자와 sudoers 1회 설정

자동 배포로 최초 SSH 접속한 뒤 확인한 OS Login POSIX 사용자를 `DEPLOY_USER`라고 합니다. 이 사용자가 `/opt/salon-web/repo`의 소유자이자 `salon-web.service`의 `User=`여야 합니다. 배포 스크립트는 두 사용자가 다르면 즉시 실패하며, 이를 우회하기 위한 `NOPASSWD:ALL` 또는 임의 `sudo -u`를 허용하지 않습니다.

배포 계정에 필요한 sudo 명령은 프론트엔드 서비스 재시작 하나뿐입니다. `sudo visudo -f /etc/sudoers.d/saloncutai-deploy`로 아래 한 줄만 등록합니다.

```sudoers
DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart salon-web
```

`DEPLOY_USER`는 실제 OS Login POSIX 사용자명으로 바꿉니다. `/usr/bin/systemctl` 경로는 VM에서 `command -v systemctl`로 확인하고, 다른 경로라면 스크립트와 sudoers를 같은 절대경로로 맞춥니다. 파일 모드는 `0440`으로 유지하고 `visudo -c`로 문법을 확인합니다.

운영 비밀값은 Git에 올리지 않는 `frontend/.env.production.local` 등 별도 환경파일로 관리할 수 있습니다. 자동 배포는 환경파일을 덮어쓰지 않고 빌드 명령에 `NEXT_PUBLIC_PUBLIC_PREVIEW=1`만 직접 전달하므로 기존 값이 보존됩니다.

빌드 명령의 `NEXT_PUBLIC_PUBLIC_PREVIEW=1`은 `.env*`보다 우선하고 `NEXT_PUBLIC_*` 값은 빌드 결과에 고정됩니다. 인증·HTTPS 적용 후 공개 미리보기 모드를 끌 때는 `.env*`만 바꾸지 말고 워크플로의 검사 빌드와 이 배포 스크립트에서 해당 환경변수 주입을 함께 제거하거나 명시적으로 변경해야 합니다.

운영 전 `workflow_dispatch`로 한 번 검증한 뒤 `dev` 자동 실행을 사용합니다.
