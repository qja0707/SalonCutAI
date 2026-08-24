# dev 브랜치 GCP VM 자동 배포

`dev`에 프론트엔드 또는 백엔드 변경이 반영되면 GitHub Actions가 검증합니다. VM 배포는 WIF 설정 시 GitHub Actions push 방식을 사용하고, WIF가 없는 현재 환경에서는 VM pull timer가 같은 검사를 확인한 뒤 `/opt/salon-web/repo`를 같은 커밋으로 동기화합니다.

## 현재 자동화 범위

- 프론트엔드: `npm ci`, 공개 미리보기 모드 빌드, `salon-web` 재시작, `127.0.0.1:3000` 상태 확인
- 백엔드: `uv sync`, Python 문법 검사, `salon-api` 재시작, `127.0.0.1:8000/api/v1/health` 상태 확인
- 환경파일: Actions push 방식은 `ENV_BACKEND` Secret을 전달하고, VM pull 방식은 기존 `backend/.env`를 그대로 유지
- 실패 처리: 성공 SHA를 기록하지 않고 5분 뒤 다시 시도

## 현재 VM pull 방식

- `/usr/local/bin/saloncutai-dev-pull`을 `saloncutai-dev-pull.timer`가 5분마다 실행합니다.
- 저장소의 최신 `dev` SHA가 마지막 성공 SHA와 다를 때만 진행합니다.
- GitHub check-runs에서 `프론트엔드 검사`와 `백엔드 문법 검사`가 모두 성공한 SHA만 배포합니다.
- `flock`으로 중복 실행을 막고, 기존 `backend/.env`를 `/tmp`로 복사하지 않습니다.
- 설치 시 현재 정상 배포 SHA를 `.git/saloncutai-last-success`에 기록해 불필요한 최초 재배포를 막습니다.

## 운영 설치본 롤아웃

저장소 파일과 VM의 운영 설치본은 별개입니다. `.github/scripts/pull-deploy-dev.sh`를 변경해 `dev`에 병합해도 systemd가 실행하는 `/usr/local/bin/saloncutai-dev-pull`은 자동으로 바뀌지 않습니다. `.github/systemd/`의 service·timer 파일도 `/etc/systemd/system` 설치본에 자동 반영되지 않습니다. 이 경로를 변경한 PR은 병합과 별도로 설치본 롤아웃 승인을 받아야 합니다.

아래 wrapper 절차는 같은 SSH shell에서 끝까지 실행합니다. `APPROVED_SHA`, `PREVIOUS_APPROVED_SHA`, `DEPLOY_USER`는 승인 기록과 VM 실측값으로 바꿉니다. VM 주소, 개인 계정명, 현재 해시, 실제 백업 파일명은 공개 문서에 기록하지 않습니다.

### wrapper 사전 확인과 lock

```bash
APP_DIR=/opt/salon-web/repo
INSTALLED=/usr/local/bin/saloncutai-dev-pull
SOURCE_PATH=.github/scripts/pull-deploy-dev.sh
APPROVED_SHA=승인된40자리mergeSHA
PREVIOUS_APPROVED_SHA=현재설치본의이전승인40자리SHA
DEPLOY_USER=실제배포사용자

git -C "$APP_DIR" fetch origin dev --prune
[[ "$APPROVED_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$PREVIOUS_APPROVED_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$(git -C "$APP_DIR" rev-parse origin/dev)" == "$APPROVED_SHA" ]]
git -C "$APP_DIR" cat-file -e "$APPROVED_SHA^{commit}"
git -C "$APP_DIR" cat-file -e "$PREVIOUS_APPROVED_SHA^{commit}"

exec 9>"$APP_DIR/.git/saloncutai-pull.lock"
flock -n 9 || { echo '자동 pull이 실행 중입니다. 롤아웃을 중단합니다.' >&2; exit 1; }
[[ "$(systemctl show saloncutai-dev-pull.service -p ActiveState --value)" != active ]]
```

lock을 얻은 shell을 닫거나 별도 shell에서 설치를 계속하지 않습니다. 설치 전에 현재 설치본이 이전 승인 커밋의 blob과 같은지 확인합니다. 다르면 VM에서 수동 수정됐을 수 있으므로 덮어쓰지 않고 중단합니다.

```bash
EXPECTED_CURRENT_SHA256=$(git -C "$APP_DIR" cat-file blob \
  "$PREVIOUS_APPROVED_SHA:$SOURCE_PATH" | sha256sum | awk '{print $1}')
TARGET_SHA256=$(git -C "$APP_DIR" cat-file blob \
  "$APPROVED_SHA:$SOURCE_PATH" | sha256sum | awk '{print $1}')
INSTALLED_SHA256=$(sha256sum "$INSTALLED" | awk '{print $1}')

[[ "$INSTALLED_SHA256" == "$EXPECTED_CURRENT_SHA256" ]] || {
  echo '현재 설치본이 이전 승인 blob과 다릅니다. 수동 변경을 확인하십시오.' >&2
  exit 1
}

read -r OWNER GROUP MODE SIZE < <(stat -c '%U %G %a %s' "$INSTALLED")
[[ "$OWNER" == "$DEPLOY_USER" || "$OWNER" == root ]]
```

### 백업과 원자 교체

백업은 owner·group·mode·mtime을 보존합니다. 대상 blob은 워킹 트리 파일을 복사하지 않고 정확한 승인 SHA에서 추출합니다. 임시 파일은 설치본과 같은 filesystem에 만들고, 해시와 Bash 문법을 확인한 뒤 `mv`로 원자 교체합니다.

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="${INSTALLED}.backup-${STAMP}"
TEMP="$(dirname "$INSTALLED")/.saloncutai-dev-pull.tmp.$$"

cleanup_rollout_temp() {
  sudo rm -f -- "$TEMP"
}
trap cleanup_rollout_temp EXIT

sudo cp --preserve=mode,ownership,timestamps -- "$INSTALLED" "$BACKUP"
BACKUP_SHA256=$(sha256sum "$BACKUP" | awk '{print $1}')
[[ "$BACKUP_SHA256" == "$EXPECTED_CURRENT_SHA256" ]]

git -C "$APP_DIR" cat-file blob "$APPROVED_SHA:$SOURCE_PATH" \
  | sudo tee "$TEMP" >/dev/null
sudo chown "$OWNER:$GROUP" "$TEMP"
sudo chmod "$MODE" "$TEMP"
[[ "$(sha256sum "$TEMP" | awk '{print $1}')" == "$TARGET_SHA256" ]]
sudo bash -n "$TEMP"
sudo mv -f -- "$TEMP" "$INSTALLED"

[[ "$(sha256sum "$INSTALLED" | awk '{print $1}')" == "$TARGET_SHA256" ]]
[[ "$(stat -c '%U %G %a' "$INSTALLED")" == "$OWNER $GROUP $MODE" ]]
sudo bash -n "$INSTALLED"
stat -c 'owner=%U group=%G mode=%a size=%s mtime=%y' "$INSTALLED" "$BACKUP"
```

배포 실패 알림용 credential은 읽거나 출력하거나 변경하지 않습니다. 경로와 권한 조건은 설치 스크립트의 `ISSUE_TOKEN_FILE` 상수를 따릅니다.

### 자동 타이머 관측과 성공 기준

설치 후 wrapper를 수동 실행하지 않습니다. lock을 해제하고 다음 scheduled timer를 관측합니다.

```bash
exec 9>&-
systemctl list-timers saloncutai-dev-pull.timer --no-pager --all
systemctl show saloncutai-dev-pull.timer saloncutai-dev-pull.service \
  -p Id -p ActiveState -p SubState -p Result -p ExecMainStatus \
  -p LastTriggerUSec --no-pager
journalctl -u saloncutai-dev-pull.service -n 160 --no-pager -o short-iso
cat "$APP_DIR/.git/saloncutai-last-success"
git -C "$APP_DIR" status --porcelain=v1
systemctl show salon-api.service salon-web.service \
  -p Id -p ActiveState -p SubState -p MainPID -p NRestarts --no-pager
```

첫 타이머가 `Result=success`, `ExecMainStatus=0`이고 dirty marker가 없으며 앱 서비스 PID와 `NRestarts`가 유지돼야 합니다. 다음 타이머가 실패하거나 두 scheduled 주기 안에 성공 기록이 없으면 새 설치본을 유지하지 않고 롤백합니다.

### wrapper 롤백

롤백도 자동 pull lock을 확보한 같은 shell에서 수행합니다. 기록한 백업 SHA와 owner·mode를 다시 확인하고, 같은 filesystem의 임시 파일을 거쳐 원자 복구합니다.

```bash
ROLLBACK_TEMP="$(dirname "$INSTALLED")/.saloncutai-dev-pull.rollback.$$"
exec 9>"$APP_DIR/.git/saloncutai-pull.lock"
flock -n 9 || { echo '자동 pull이 실행 중입니다. 롤백을 중단합니다.' >&2; exit 1; }
[[ "$(sha256sum "$BACKUP" | awk '{print $1}')" == "$BACKUP_SHA256" ]]

sudo cp --preserve=mode,ownership,timestamps -- "$BACKUP" "$ROLLBACK_TEMP"
[[ "$(stat -c '%U %G %a' "$ROLLBACK_TEMP")" == "$OWNER $GROUP $MODE" ]]
sudo bash -n "$ROLLBACK_TEMP"
sudo mv -f -- "$ROLLBACK_TEMP" "$INSTALLED"
[[ "$(sha256sum "$INSTALLED" | awk '{print $1}')" == "$BACKUP_SHA256" ]]
sudo bash -n "$INSTALLED"
exec 9>&-
```

롤백 뒤에도 wrapper를 수동 실행하지 않고 다음 scheduled timer를 관측합니다. 백업은 리뷰와 운영 확인이 끝날 때까지 보존하고, 폐기 시각과 담당자를 운영 기록에 남깁니다.

### systemd service·timer 롤아웃

`.github/systemd/saloncutai-dev-pull.service`와 `.timer`도 별도 설치 대상입니다. wrapper와 같은 승인 SHA·known-good 해시·lock·backup·same-filesystem atomic replace 원칙을 적용하되 다음 차이가 있습니다.

1. 승인 SHA의 두 unit blob을 각각 임시 파일로 추출합니다.
2. 현재 `/etc/systemd/system` 설치본이 이전 승인 blob과 같은지 확인합니다.
3. owner `root`, group `root`, mode `644`를 유지합니다.
4. `systemd-analyze verify`로 임시 unit을 검사한 뒤 원자 교체합니다.
5. 두 파일의 해시를 다시 확인하고 `sudo systemctl daemon-reload`를 실행합니다.
6. timer schedule이 바뀐 경우에만 별도 승인 아래 timer 재시작을 수행합니다. pull service는 수동 실행하지 않습니다.
7. 다음 scheduled timer의 result·journal·앱 서비스 무변화를 확인합니다.
8. 실패하면 두 unit을 함께 원자 롤백하고 `daemon-reload` 후 다음 timer를 다시 관측합니다.

설치본 drift 자동 감지는 후속 개선 후보입니다. wrapper가 자기 해시와 대상 SHA blob 해시를 비교해 비차단 경고를 남기는 것은 가능하지만, 이전 wrapper는 최초 drift를 스스로 감지할 수 없고 알림 연결 시 중복·오탐 검증이 추가됩니다. 마감 직전 배포 경로 코드를 늘리지 않고 이번에는 문서 절차로 관리합니다.

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
