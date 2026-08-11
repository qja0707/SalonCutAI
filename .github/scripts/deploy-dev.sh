#!/usr/bin/env bash
set -Eeuo pipefail

readonly TARGET_SHA="${1:-}"
readonly APP_DIR="/opt/salon-web/repo"
readonly FRONTEND_DIR="${APP_DIR}/frontend"
readonly BACKEND_DIR="${APP_DIR}/backend"
readonly NODE_BIN="/opt/node/bin"
readonly FRONTEND_SERVICE="salon-web"
readonly BACKEND_SERVICE="salon-api"

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
  env HOME="${APP_HOME}" PATH="${NODE_BIN}:${APP_HOME}/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$@"
}

log "origin/dev 최신 상태 확인"
run_as_app_user git -C "${APP_DIR}" fetch origin dev --prune
readonly REMOTE_SHA="$(run_as_app_user git -C "${APP_DIR}" rev-parse origin/dev)"

if [[ "${TARGET_SHA}" != "${REMOTE_SHA}" ]]; then
  log "더 최신 dev 커밋이 있어 오래된 배포를 건너뜁니다. 대상=${TARGET_SHA}, 최신=${REMOTE_SHA}"
  exit 0
fi

readonly BEFORE_SHA="$(run_as_app_user git -C "${APP_DIR}" rev-parse HEAD)"

if [[ "${BEFORE_SHA}" == "${TARGET_SHA}" ]]; then
  log "이미 대상 커밋이 반영되어 있습니다."
  exit 0
fi

readonly CHANGED_FILES="$(run_as_app_user git -C "${APP_DIR}" diff --name-only "${BEFORE_SHA}" "${TARGET_SHA}")"

log "저장소를 대상 dev 커밋으로 동기화 (git reset)"
run_as_app_user git -C "${APP_DIR}" reset --hard "${TARGET_SHA}"


# ==========================================
# 1. 백엔드 배포 프로세스
# ==========================================
if grep -Eq '^(backend/|pyproject\.toml$)' <<<"${CHANGED_FILES}"; then
  log "백엔드 의존성 동기화 및 문법 검사 시작"
  
  if [[ -f "/tmp/backend.env.tmp" ]]; then
    run_as_app_user mv /tmp/backend.env.tmp "${BACKEND_DIR}/.env"
    run_as_app_user chmod 600 "${BACKEND_DIR}/.env"
  fi

  if [[ -f "${BACKEND_DIR}/pyproject.toml" ]]; then
    run_as_app_user uv sync --project "${BACKEND_DIR}"
  fi

  run_as_app_user python3 -m compileall -q "${BACKEND_DIR}/src"
  
  log "백엔드 서비스 재시작"
  sudo -n /usr/bin/systemctl restart "${BACKEND_SERVICE}"

  BACKEND_HEALTH_OK=0
  for attempt in {1..10}; do
    if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:8000/health >/dev/null; then
      log "백엔드 재시작 및 로컬 상태 확인 완료"
      BACKEND_HEALTH_OK=1
      break
    fi
    sleep 2
  done

  if [[ "${BACKEND_HEALTH_OK}" -ne 1 ]]; then
    fail "백엔드 재시작 후 상태 확인 실패 (8000 포트 응답 없음)"
  fi
else
  log "백엔드 변경 없음"
fi


# ==========================================
# 2. 프론트엔드 배포 프로세스
# ==========================================
if grep -Eq '^(frontend/|\.github/scripts/deploy-dev\.sh$)' <<<"${CHANGED_FILES}"; then
  log "프론트엔드 빌드 시작"

  if [[ ! -d "${FRONTEND_DIR}/node_modules" ]] || grep -Eq '^frontend/(package\.json|package-lock\.json)$' <<<"${CHANGED_FILES}"; then
    log "npm 잠금 파일 기준 의존성 설치"
    run_as_app_user npm --prefix "${FRONTEND_DIR}" ci --no-audit --no-fund
  fi

  # 단순하게 기존 .next 폴더 위에서 그대로 빌드 진행
  run_as_app_user env NEXT_PUBLIC_PUBLIC_PREVIEW=1 npm --prefix "${FRONTEND_DIR}" run build

  log "프론트엔드 서비스 재시작"
  sudo -n /usr/bin/systemctl restart "${FRONTEND_SERVICE}"

  HEALTH_OK=0
  for attempt in {1..15}; do
    if curl --fail --silent --show-error --max-time 3 http://127.0.0 >/dev/null; then
      log "프론트엔드 재시작 및 로컬 상태 확인 완료"
      HEALTH_OK=1
      break
    fi
    sleep 2
  done

  if [[ "${HEALTH_OK}" -ne 1 ]]; then
    fail "프론트엔드 재시작 후 상태 확인 실패 (3000 포트 응답 없음)"
  fi
else
  log "프론트엔드 변경 없음"
fi

log "배포 완료: ${TARGET_SHA}"
