#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_DIR="/opt/salon-web/repo"
readonly STATE_FILE="${APP_DIR}/.git/saloncutai-last-success"
readonly LOCK_FILE="${APP_DIR}/.git/saloncutai-pull.lock"
readonly CHECKS_API="https://api.github.com/repos/qja0707/SalonCutAI/commits"
readonly ISSUES_API="https://api.github.com/repos/qja0707/SalonCutAI/issues"
readonly ISSUE_TOKEN_FILE="/opt/salon-web/credentials/github-issues-token"
readonly FAILURE_ALERT_STATE="${APP_DIR}/.git/saloncutai-last-failure-alert"
readonly MODE="${1:-}"
readonly CHECK_SHA="${2:-}"

REMOTE_SHA=""
DEPLOY_SCRIPT=""
DEPLOY_LOG=""

log() {
  printf '[SalonCutAI pull] %s\n' "$*"
}

cleanup() {
  [[ -z "${DEPLOY_SCRIPT}" ]] || rm -f -- "${DEPLOY_SCRIPT}"
  [[ -z "${DEPLOY_LOG}" ]] || rm -f -- "${DEPLOY_LOG}"
}

notify_deployment_failure() {
  local sha="$1"
  local exit_code="$2"
  local deploy_log="$3"
  local issues_api="${4:-${ISSUES_API}}"
  local token_file="${5:-${ISSUE_TOKEN_FILE}}"
  local alert_state="${6:-${FAILURE_ALERT_STATE}}"
  local token_dir="${token_file%/*}"
  local state_tmp="${alert_state}.tmp.$$"
  local api_status

  if [[ ! "${sha}" =~ ^[0-9a-f]{40}$ ]]; then
    log "배포 실패 알림 SHA가 올바르지 않아 이슈 생성을 건너뜁니다."
    return 1
  fi
  if [[ "$(cat "${alert_state}" 2>/dev/null || true)" == "${sha}" ]]; then
    log "같은 커밋의 배포 실패 이슈가 이미 생성돼 건너뜁니다: ${sha}"
    return 0
  fi
  if [[ ! -d "${token_dir}" || ! -f "${token_file}" ]]; then
    log "배포 실패 알림 토큰을 사용할 수 없어 이슈 생성을 건너뜁니다."
    return 1
  fi
  if [[ "$(stat -c '%U' "${token_dir}")" != "$(id -un)" \
    || "$(stat -c '%a' "${token_dir}")" != "700" \
    || "$(stat -c '%U' "${token_file}")" != "$(id -un)" \
    || "$(stat -c '%a' "${token_file}")" != "600" ]]; then
    log "배포 실패 알림 토큰 권한이 안전하지 않아 이슈 생성을 건너뜁니다."
    return 1
  fi

  umask 077
  if ! printf '%s\n' "${sha}" >"${state_tmp}"; then
    rm -f -- "${state_tmp}" 2>/dev/null || true
    log "배포 실패 알림 상태를 준비하지 못했습니다."
    return 1
  fi

  if ! api_status="$(python3 - \
    "${sha}" "${exit_code}" "${deploy_log}" "${issues_api}" "${token_file}" <<'PY'
import datetime
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sha, exit_code, log_path, issues_api, token_path = sys.argv[1:]


def redact(text: str) -> str:
    text = re.sub(
        r"(?i)\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+",
        "<redacted>",
        text,
    )
    text = re.sub(
        r"(?i)(bearer\s+)[^\s,;]+",
        r"\1<redacted>",
        text,
    )
    text = re.sub(
        r"(?i)([A-Za-z0-9_]*(?:authorization|token|key|secret|password)"
        r"[A-Za-z0-9_]*\s*[:=]\s*)[^\s,;]+",
        r"\1<redacted>",
        text,
    )
    return text.replace("`", "'")


try:
    lines = Path(log_path).read_text(encoding="utf-8", errors="replace").splitlines()
except OSError:
    lines = []
stage_lines = [redact(line)[:300] for line in lines if "[SalonCutAI 배포]" in line]
stage_lines = stage_lines[-3:]
if stage_lines:
    stage = stage_lines[-1].split("[SalonCutAI 배포]", 1)[-1].strip()[:180]
    summary = "\n".join(stage_lines)[:1000]
else:
    stage = "pull wrapper"
    summary = "세부 단계 로그 없음"

created_at = datetime.datetime.now(datetime.UTC).replace(microsecond=0).isoformat()
body = (
    f"자동 배포 실패를 감지했습니다.\n\n"
    f"- 발생 시각(UTC): {created_at}\n"
    f"- 커밋: `{sha}`\n"
    f"- 실패 단계: {stage}\n"
    f"- 종료 코드: {exit_code}\n\n"
    f"오류 요약:\n\n```text\n{summary}\n```"
)
payload = json.dumps(
    {"title": f"[배포 실패] {sha[:8]}", "body": body},
    ensure_ascii=False,
).encode("utf-8")
token = Path(token_path).read_text(encoding="utf-8").strip()
if not token:
    print("ISSUE_API_STATUS=token_unavailable")
    raise SystemExit(1)
request = urllib.request.Request(
    issues_api,
    data=payload,
    method="POST",
    headers={
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "SalonCutAI-VM",
        "X-GitHub-Api-Version": "2022-11-28",
    },
)
try:
    with urllib.request.urlopen(request, timeout=10) as response:
        status = response.status
except urllib.error.HTTPError as error:
    print(f"ISSUE_API_STATUS={error.code}")
    raise SystemExit(1)
except (TimeoutError, urllib.error.URLError):
    print("ISSUE_API_STATUS=transport_error")
    raise SystemExit(1)
print(f"ISSUE_API_STATUS={status}")
raise SystemExit(0 if status == 201 else 1)
PY
  )"; then
    rm -f -- "${state_tmp}" 2>/dev/null || true
    [[ -z "${api_status}" ]] || log "${api_status}"
    return 1
  fi
  [[ -z "${api_status}" ]] || log "${api_status}"

  if ! mv "${state_tmp}" "${alert_state}"; then
    rm -f -- "${state_tmp}"
    log "배포 실패 알림 상태를 기록하지 못했습니다."
    return 1
  fi
  log "배포 실패 이슈 알림 완료: ${sha}"
}

deployment_failed() {
  local trapped_code="$?"
  local code="${1:-${trapped_code}}"
  local issues_api="${2:-${ISSUES_API}}"
  local token_file="${3:-${ISSUE_TOKEN_FILE}}"
  local alert_state="${4:-${FAILURE_ALERT_STATE}}"
  trap - ERR
  notify_deployment_failure \
    "${REMOTE_SHA}" "${code}" "${DEPLOY_LOG}" \
    "${issues_api}" "${token_file}" "${alert_state}" \
    || log "배포 실패 이슈 알림을 완료하지 못했습니다."
  log "SALONCUT_DEPLOY_FAILED sha=${REMOTE_SHA} code=${code}"
  exit "${code}"
}

[[ -d "${APP_DIR}/.git" ]] || { log "저장소를 찾을 수 없습니다."; exit 1; }
[[ "$(id -un)" == "$(stat -c '%U' "${APP_DIR}")" ]] || { log "실행 사용자와 저장소 소유자가 다릅니다."; exit 1; }
[[ -z "${MODE}" || "${MODE}" == "--check-ci" ]] || { log "지원하지 않는 인자입니다."; exit 1; }
[[ -z "${CHECK_SHA}" || ( "${MODE}" == "--check-ci" && "${CHECK_SHA}" =~ ^[0-9a-f]{40}$ ) ]] || { log "올바른 CI 확인 SHA가 필요합니다."; exit 1; }

exec 9>"${LOCK_FILE}"
flock -n 9 || { log "이전 배포가 실행 중이라 건너뜁니다."; exit 0; }

export HOME="$(getent passwd "$(id -un)" | cut -d: -f6)"
git -C "${APP_DIR}" fetch origin dev --prune
REMOTE_SHA="$(git -C "${APP_DIR}" rev-parse origin/dev)"
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

DEPLOY_SCRIPT="$(mktemp "${APP_DIR}/.git/deploy-dev.XXXXXX")"
DEPLOY_LOG="$(mktemp "${APP_DIR}/.git/deploy-dev-log.XXXXXX")"
trap cleanup EXIT
trap deployment_failed ERR

git -C "${APP_DIR}" show "${REMOTE_SHA}:.github/scripts/deploy-dev.sh" >"${DEPLOY_SCRIPT}"
chmod 700 "${DEPLOY_SCRIPT}"
if "${DEPLOY_SCRIPT}" "${REMOTE_SHA}" 2>&1 | tee "${DEPLOY_LOG}"; then
  :
else
  pipeline_status=("${PIPESTATUS[@]}")
  if (( pipeline_status[0] != 0 )); then
    deployment_failed "${pipeline_status[0]}"
  fi
  deployment_failed "${pipeline_status[1]}"
fi
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
