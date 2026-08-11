#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_DIR="/opt/salon-web/repo"
readonly STATE_FILE="${APP_DIR}/.git/saloncutai-last-success"
readonly LOCK_FILE="${APP_DIR}/.git/saloncutai-pull.lock"
readonly CHECKS_API="https://api.github.com/repos/qja0707/SalonCutAI/commits"
readonly MODE="${1:-}"
readonly CHECK_SHA="${2:-}"

log() {
  printf '[SalonCutAI pull] %s\n' "$*"
}

[[ -d "${APP_DIR}/.git" ]] || { log "저장소를 찾을 수 없습니다."; exit 1; }
[[ "$(id -un)" == "$(stat -c '%U' "${APP_DIR}")" ]] || { log "실행 사용자와 저장소 소유자가 다릅니다."; exit 1; }
[[ -z "${MODE}" || "${MODE}" == "--check-ci" ]] || { log "지원하지 않는 인자입니다."; exit 1; }
[[ -z "${CHECK_SHA}" || ( "${MODE}" == "--check-ci" && "${CHECK_SHA}" =~ ^[0-9a-f]{40}$ ) ]] || { log "올바른 CI 확인 SHA가 필요합니다."; exit 1; }

exec 9>"${LOCK_FILE}"
flock -n 9 || { log "이전 배포가 실행 중이라 건너뜁니다."; exit 0; }

export HOME="$(getent passwd "$(id -un)" | cut -d: -f6)"
git -C "${APP_DIR}" fetch origin dev --prune
readonly REMOTE_SHA="$(git -C "${APP_DIR}" rev-parse origin/dev)"
readonly LAST_SUCCESS="$(cat "${STATE_FILE}" 2>/dev/null || true)"
readonly CI_SHA="${CHECK_SHA:-${REMOTE_SHA}}"

if [[ "${MODE}" != "--check-ci" && "${REMOTE_SHA}" == "${LAST_SUCCESS}" ]]; then
  log "이미 반영된 커밋입니다: ${REMOTE_SHA}"
  exit 0
fi

if ! python3 - "${CI_SHA}" "${CHECKS_API}" <<'PY'
import json
import sys
import urllib.request

sha, api = sys.argv[1:]
request = urllib.request.Request(
    f"{api}/{sha}/check-runs?filter=latest&per_page=100",
    headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "SalonCutAI-VM",
        "X-GitHub-Api-Version": "2022-11-28",
    },
)
with urllib.request.urlopen(request, timeout=10) as response:
    runs = json.load(response)["check_runs"]

latest = {run["name"]: run.get("conclusion") for run in runs}
required = ("프론트엔드 검사", "백엔드 문법 검사")
not_ready = [name for name in required if latest.get(name) != "success"]
if not_ready:
    print("CI 대기: " + ", ".join(f"{name}={latest.get(name, '없음')}" for name in not_ready))
    raise SystemExit(1)
PY
then
  log "CI가 아직 통과하지 않아 다음 주기에 다시 확인합니다."
  exit 0
fi

if [[ "${MODE}" == "--check-ci" ]]; then
  log "CI 게이트 통과: ${CI_SHA}"
  exit 0
fi

readonly DEPLOY_SCRIPT="$(mktemp "${APP_DIR}/.git/deploy-dev.XXXXXX")"
cleanup() {
  rm -f -- "${DEPLOY_SCRIPT}"
}
trap cleanup EXIT
deployment_failed() {
  readonly code="$?"
  trap - ERR
  log "SALONCUT_DEPLOY_FAILED sha=${REMOTE_SHA} code=${code}"
  exit "${code}"
}
trap deployment_failed ERR

git -C "${APP_DIR}" show "${REMOTE_SHA}:.github/scripts/deploy-dev.sh" >"${DEPLOY_SCRIPT}"
chmod 700 "${DEPLOY_SCRIPT}"
"${DEPLOY_SCRIPT}" "${REMOTE_SHA}"
trap - ERR

git -C "${APP_DIR}" fetch origin dev --prune
readonly AFTER_SHA="$(git -C "${APP_DIR}" rev-parse origin/dev)"
if [[ "${AFTER_SHA}" != "${REMOTE_SHA}" ]]; then
  log "배포 중 dev가 변경되어 성공 기록을 보류합니다."
  exit 0
fi

printf '%s\n' "${REMOTE_SHA}" >"${STATE_FILE}.tmp"
mv "${STATE_FILE}.tmp" "${STATE_FILE}"
log "자동 배포 완료: ${REMOTE_SHA}"
