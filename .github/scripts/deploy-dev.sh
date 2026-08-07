#!/usr/bin/env bash
set -Eeuo pipefail

readonly TARGET_SHA="${1:-}"
readonly APP_DIR="/opt/salon-web/repo"
readonly FRONTEND_DIR="${APP_DIR}/frontend"
readonly NODE_BIN="/opt/node/bin"
readonly FRONTEND_SERVICE="salon-web"

log() {
  printf '[SalonCutAI 배포] %s\n' "$*"
}

fail() {
  log "실패: $*"
  exit 1
}

[[ "${TARGET_SHA}" =~ ^[0-9a-f]{40}$ ]] || fail "올바른 Git 커밋 SHA가 필요합니다."
[[ -d "${APP_DIR}/.git" ]] || fail "VM 저장소를 찾을 수 없습니다: ${APP_DIR}"
[[ "$(readlink -f "${APP_DIR}")" == "/opt/salon-web/repo" ]] || fail "예상하지 못한 저장소 경로입니다."

readonly APP_OWNER="$(stat -c '%U' "${APP_DIR}")"
readonly APP_HOME="$(getent passwd "${APP_OWNER}" | cut -d: -f6)"

[[ "$(id -un)" == "${APP_OWNER}" ]] || fail "배포 로그인 사용자와 저장소 소유자가 다릅니다. NOPASSWD:ALL 또는 임의 sudo -u를 추가하지 말고 배포 계정이 저장소를 소유하도록 설정하십시오."

run_as_app_user() {
  env HOME="${APP_HOME}" PATH="${NODE_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$@"
}

log "origin/dev 최신 상태 확인"
run_as_app_user git -C "${APP_DIR}" fetch origin dev --prune
readonly REMOTE_SHA="$(run_as_app_user git -C "${APP_DIR}" rev-parse origin/dev)"

if [[ "${TARGET_SHA}" != "${REMOTE_SHA}" ]]; then
  log "더 최신 dev 커밋이 있어 오래된 배포를 건너뜁니다. 대상=${TARGET_SHA}, 최신=${REMOTE_SHA}"
  exit 0
fi

run_as_app_user git -C "${APP_DIR}" cat-file -e "${TARGET_SHA}^{commit}"
readonly BEFORE_SHA="$(run_as_app_user git -C "${APP_DIR}" rev-parse HEAD)"

if [[ "${BEFORE_SHA}" == "${TARGET_SHA}" ]]; then
  log "이미 대상 커밋이 반영되어 있습니다."
  exit 0
fi

readonly CHANGED_FILES="$(run_as_app_user git -C "${APP_DIR}" diff --name-only "${BEFORE_SHA}" "${TARGET_SHA}")"
FRONTEND_ROLLBACK_READY=0
FRONTEND_RESTART_ATTEMPTED=0

rollback_deployment() {
  local reason="${1:-알 수 없는 오류}"
  trap - ERR
  set +e

  log "배포 롤백 시작: ${reason}"

  if [[ "${FRONTEND_ROLLBACK_READY}" -eq 1 && -d "${FRONTEND_DIR}/.next.rollback" ]]; then
    run_as_app_user rm -rf -- "${FRONTEND_DIR}/.next"
    run_as_app_user mv "${FRONTEND_DIR}/.next.rollback" "${FRONTEND_DIR}/.next"
  fi

  run_as_app_user git -C "${APP_DIR}" reset --hard "${BEFORE_SHA}"

  if [[ "${FRONTEND_RESTART_ATTEMPTED}" -eq 1 ]]; then
    sudo -n /usr/bin/systemctl restart "${FRONTEND_SERVICE}"
    if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
      log "직전 프론트엔드 서비스 복원 확인"
    else
      log "경고: 직전 서비스 복원 후 상태 확인 실패. journalctl 확인이 필요합니다."
    fi
  fi

  log "롤백 완료: 소스=${BEFORE_SHA}"
  exit 1
}

trap 'rollback_deployment "예기치 않은 오류(행 ${LINENO})"' ERR

log "저장소를 대상 dev 커밋으로 동기화"
run_as_app_user git -C "${APP_DIR}" reset --hard "${TARGET_SHA}"

if grep -Eq '^(backend/|pyproject\.toml$)' <<<"${CHANGED_FILES}"; then
  log "백엔드 소스 문법 검사"
  run_as_app_user python3 -m compileall -q "${APP_DIR}/backend/src"
  log "백엔드 소스 동기화 완료. API 헬스체크와 systemd 계약 확정 전까지 자동 재시작은 보류합니다."
else
  log "백엔드 변경 없음"
fi

if grep -Eq '^(frontend/|\.github/scripts/deploy-dev\.sh$)' <<<"${CHANGED_FILES}"; then
  log "프론트엔드 빌드 시작"

  if [[ ! -d "${FRONTEND_DIR}/node_modules" ]] || grep -Eq '^frontend/(package\.json|package-lock\.json)$' <<<"${CHANGED_FILES}"; then
    log "npm 잠금 파일 기준 의존성 설치"
    run_as_app_user npm --prefix "${FRONTEND_DIR}" ci --no-audit --no-fund
  fi

  if [[ -d "${FRONTEND_DIR}/.next.rollback" ]]; then
    run_as_app_user rm -rf -- "${FRONTEND_DIR}/.next.rollback"
  fi
  if [[ -d "${FRONTEND_DIR}/.next" ]]; then
    run_as_app_user mv "${FRONTEND_DIR}/.next" "${FRONTEND_DIR}/.next.rollback"
    FRONTEND_ROLLBACK_READY=1
  fi

  # NEXT_PUBLIC_* 값은 빌드 시점에 고정된다. 사람이 관리하는 .env* 파일은 수정하지 않는다.
  run_as_app_user env NEXT_PUBLIC_PUBLIC_PREVIEW=1 npm --prefix "${FRONTEND_DIR}" run build

  FRONTEND_RESTART_ATTEMPTED=1
  sudo -n /usr/bin/systemctl restart "${FRONTEND_SERVICE}"

  HEALTH_OK=0
  for attempt in {1..15}; do
    if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:3000/ >/dev/null; then
      log "프론트엔드 재시작 및 로컬 상태 확인 완료"
      HEALTH_OK=1
      break
    fi
    sleep 2
  done

  if [[ "${HEALTH_OK}" -ne 1 ]]; then
    rollback_deployment "프론트엔드 재시작 후 상태 확인 실패"
  fi

  run_as_app_user rm -rf -- "${FRONTEND_DIR}/.next.rollback"
  FRONTEND_ROLLBACK_READY=0
else
  log "프론트엔드 변경 없음"
fi

trap - ERR

log "배포 완료: ${TARGET_SHA}"
