#!/usr/bin/env bash
set -Eeuo pipefail

readonly TARGET_SHA="${1:-}"
readonly BACKEND_ENV_TMP="${2:-}"
readonly APP_DIR="/opt/salon-web/repo"
readonly FRONTEND_DIR="${APP_DIR}/frontend"
readonly BACKEND_DIR="${APP_DIR}/backend"
readonly NODE_BIN="/opt/node/bin"
readonly FRONTEND_SERVICE="salon-web"
readonly BACKEND_SERVICE="salon-api"
readonly STATE_FILE="${APP_DIR}/.git/saloncutai-last-success"
readonly DIRTY_FILE="${APP_DIR}/.git/saloncutai-deploy-dirty"

CHANGE_LIST_FILE=""
RUN_BACKEND=0
RUN_FRONTEND=0
BACKEND_REASON="변경 없음"
FRONTEND_REASON="변경 없음"
LAST_SUCCESS=""

log() {
  printf '[SalonCutAI 배포] %s\n' "$*"
}

fail() {
  log "실패: $*"
  exit 1
}

cleanup() {
  if [[ -n "${BACKEND_ENV_TMP}" ]]; then
    rm -f -- "${BACKEND_ENV_TMP}"
  fi
  if [[ -n "${CHANGE_LIST_FILE}" ]]; then
    rm -f -- "${CHANGE_LIST_FILE}"
  fi
}

[[ "${TARGET_SHA}" =~ ^[0-9a-f]{40}$ ]] || fail "올바른 Git 커밋 SHA가 필요합니다."
if [[ -n "${BACKEND_ENV_TMP}" ]]; then
  [[ "${BACKEND_ENV_TMP}" =~ ^/tmp/backend\.env\.[0-9]+\.[0-9]+$ ]] || fail "올바른 백엔드 환경 변수 임시 경로가 필요합니다."
fi
trap cleanup EXIT
[[ -d "${APP_DIR}/.git" ]] || fail "VM 저장소를 찾을 수 없습니다: ${APP_DIR}"
[[ "$(readlink -f "${APP_DIR}")" == "/opt/salon-web/repo" ]] || fail "예상하지 못한 저장소 경로입니다."

readonly APP_OWNER="$(stat -c '%U' "${APP_DIR}")"
readonly APP_HOME="$(getent passwd "${APP_OWNER}" | cut -d: -f6)"

[[ "$(id -un)" == "${APP_OWNER}" ]] || fail "배포 로그인 사용자와 저장소 소유자가 다릅니다. NOPASSWD:ALL 또는 임의 sudo -u를 추가하지 말고 배포 계정이 저장소를 소유하도록 설정하십시오."

run_as_app_user() {
  env HOME="${APP_HOME}" PATH="${NODE_BIN}:${APP_HOME}/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$@"
}

run_backend() {
  RUN_BACKEND=1
  BACKEND_REASON="$1"
}

run_frontend() {
  RUN_FRONTEND=1
  FRONTEND_REASON="$1"
}

run_all() {
  run_backend "$1"
  run_frontend "$1"
}

classify_changes() {
  if [[ -s "${STATE_FILE}" ]]; then
    LAST_SUCCESS="$(tr -d '[:space:]' <"${STATE_FILE}")"
  fi
  if [[ -e "${DIRTY_FILE}" ]]; then
    run_all "이전 배포 미완료 표식 존재"
    return
  fi

  if [[ ! -s "${STATE_FILE}" ]]; then
    run_all "last-success 없음"
    return
  fi

  if [[ ! "${LAST_SUCCESS}" =~ ^[0-9a-f]{40}$ ]]; then
    run_all "last-success 형식 오류"
    return
  fi
  if ! run_as_app_user git -C "${APP_DIR}" cat-file -e "${LAST_SUCCESS}^{commit}" 2>/dev/null; then
    run_all "last-success 커밋 없음"
    return
  fi
  if ! run_as_app_user git -C "${APP_DIR}" merge-base --is-ancestor "${LAST_SUCCESS}" "${TARGET_SHA}"; then
    run_all "last-success가 대상의 조상 아님"
    return
  fi

  CHANGE_LIST_FILE="$(mktemp "${APP_DIR}/.git/saloncutai-change-list.XXXXXX")"
  if ! run_as_app_user git -C "${APP_DIR}" -c core.quotepath=false diff --name-only --no-renames "${LAST_SUCCESS}" "${TARGET_SHA}" >"${CHANGE_LIST_FILE}"; then
    run_all "변경 경로 판정 실패"
    return
  fi

  while IFS= read -r path; do
    [[ -n "${path}" ]] || continue
    case "${path}" in
      backend/*)
        run_backend "backend 변경: ${path}"
        ;;
      frontend/*)
        run_frontend "frontend 변경: ${path}"
        ;;
      .github/scripts/deploy-dev.sh)
        run_all "deploy-dev.sh 변경"
        ;;
      .github/scripts/pull-deploy-dev.sh)
        log "별도 롤아웃 필요: pull-deploy-dev.sh 저장소 변경은 설치본에 자동 반영되지 않습니다."
        ;;
      .github/systemd/*.service|.github/systemd/*.timer)
        log "별도 롤아웃 필요: systemd unit 저장소 변경은 설치·daemon-reload 없이 운영에 반영되지 않습니다."
        ;;
      .github/workflows/*)
        log "CI 계약 확인 필요: workflow 변경은 앱 재시작 대상이 아니며 required check 이름 호환을 유지해야 합니다."
        ;;
      *.md|docs/*|운영기반/*|1팀_제안서/*|.gitignore|LICENSE)
        log "런타임 무관 변경으로 분류: ${path}"
        ;;
      *)
        run_all "분류 불가 경로: ${path}"
        ;;
    esac
  done <"${CHANGE_LIST_FILE}"
}

check_backend_health() {
  local health_ok=0
  for attempt in {1..10}; do
    if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:8000/api/v1/health >/dev/null; then
      log "백엔드 로컬 상태 확인 완료"
      health_ok=1
      break
    fi
    sleep 2
  done
  if [[ "${health_ok}" -ne 1 ]]; then
    log "백엔드 상태 확인 실패 (8000 포트 응답 없음)"
    return 1
  fi
}

check_frontend_health() {
  local health_ok=0
  for attempt in {1..15}; do
    if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:3000 >/dev/null; then
      log "프론트엔드 로컬 상태 확인 완료"
      health_ok=1
      break
    fi
    sleep 2
  done
  if [[ "${health_ok}" -ne 1 ]]; then
    log "프론트엔드 상태 확인 실패 (3000 포트 응답 없음)"
    return 1
  fi
}

log "origin/dev 최신 상태 확인"
run_as_app_user git -C "${APP_DIR}" fetch origin dev --prune
readonly REMOTE_SHA="$(run_as_app_user git -C "${APP_DIR}" rev-parse origin/dev)"

if [[ "${TARGET_SHA}" != "${REMOTE_SHA}" ]]; then
  log "더 최신 dev 커밋이 있어 오래된 배포를 건너뜁니다. 대상=${TARGET_SHA}, 최신=${REMOTE_SHA}"
  exit 0
fi

classify_changes
if [[ -n "${BACKEND_ENV_TMP}" ]]; then
  run_backend "새 백엔드 환경파일 전달"
fi

log "변경 판정 기준: last-success=${LAST_SUCCESS:-없음}, target=${TARGET_SHA}"
if [[ "${RUN_BACKEND}" -eq 1 ]]; then
  log "백엔드 실행: ${BACKEND_REASON}"
else
  log "백엔드 스킵: ${BACKEND_REASON}"
fi
if [[ "${RUN_FRONTEND}" -eq 1 ]]; then
  log "프론트엔드 실행: ${FRONTEND_REASON}"
else
  log "프론트엔드 스킵: ${FRONTEND_REASON}"
fi

printf 'target=%s\nstarted_at=%s\n' "${TARGET_SHA}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"${DIRTY_FILE}.tmp"
mv "${DIRTY_FILE}.tmp" "${DIRTY_FILE}"

log "저장소를 대상 dev 커밋으로 동기화"
run_as_app_user git -C "${APP_DIR}" checkout -f "${TARGET_SHA}"


# ==========================================
# 1. 백엔드 배포 프로세스
# ==========================================
if [[ "${RUN_BACKEND}" -eq 1 ]]; then
  log "백엔드 의존성 동기화 및 문법 검사 시작"

  if [[ -n "${BACKEND_ENV_TMP}" ]]; then
    [[ -s "${BACKEND_ENV_TMP}" ]] || fail "백엔드 환경 변수 임시 파일이 없거나 비어 있습니다."
    chmod 600 "${BACKEND_ENV_TMP}"
    run_as_app_user mv "${BACKEND_ENV_TMP}" "${BACKEND_DIR}/.env"
  else
    [[ -s "${BACKEND_DIR}/.env" ]] || fail "기존 백엔드 환경 변수 파일이 없거나 비어 있습니다."
  fi
  run_as_app_user chmod 600 "${BACKEND_DIR}/.env"

  if [[ -f "${BACKEND_DIR}/pyproject.toml" ]]; then
    run_as_app_user uv sync --project "${BACKEND_DIR}"
  fi
  run_as_app_user python3 -m compileall -q "${BACKEND_DIR}/src"

  log "백엔드 서비스 재시작"
  sudo -n /usr/bin/systemctl restart "${BACKEND_SERVICE}"
fi


# ==========================================
# 2. 프론트엔드 배포 프로세스
# ==========================================
if [[ "${RUN_FRONTEND}" -eq 1 ]]; then
  log "프론트엔드 빌드 시작"
  log "npm 잠금 파일 기준 의존성 설치"
  run_as_app_user npm --prefix "${FRONTEND_DIR}" ci --no-audit --no-fund

  log "Next.js 프로덕션 빌드 실행"
  run_as_app_user env NEXT_PUBLIC_PUBLIC_PREVIEW=1 npm --prefix "${FRONTEND_DIR}" run build

  log "프론트엔드 서비스 재시작"
  sudo -n /usr/bin/systemctl restart "${FRONTEND_SERVICE}"
fi

HEALTH_FAILED=0
if ! check_backend_health; then
  HEALTH_FAILED=1
fi
if ! check_frontend_health; then
  HEALTH_FAILED=1
fi
[[ "${HEALTH_FAILED}" -eq 0 ]] || fail "서비스 상태 확인 실패"
rm -f -- "${DIRTY_FILE}"
log "배포 완료: ${TARGET_SHA}"
