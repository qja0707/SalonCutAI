import { appendFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * 화면 오류를 파일로 남긴다 — #119 리뷰 반영.
 *
 * 콘솔만으로는 부족하다는 지적이 맞다: 서버는 서비스·데몬으로 떠 있고 터미널 버퍼에는
 * 한계가 있으며 사람이 모니터링하는 구조가 아니다. 그래서
 *
 *   1. 날짜별 파일로 저장한다 (`logs/client-errors/2026-08-18.log`, KST 기준).
 *      한 줄이 JSON 하나라 grep·jq 로 바로 걸러진다
 *   2. 오래된 파일은 스스로 지운다 — 쓰기가 일어날 때 한 시간에 한 번, 보관 기한(7일)이
 *      지난 파일을 정리한다. 별도 배치·cron 없이 무한히 쌓이지 않는다
 *
 * 로그 디렉터리는 프로세스 작업 디렉터리 밑 `logs/` 다(.gitignore 에 있음). 배포 스크립트가
 * 레포를 갈아엎어도 디버그 로그라 잃어서 치명적이지 않고, 쓰기 실패는 콘솔 기록만 남기고
 * 삼킨다 — 로그 때문에 응답이 죽으면 본말전도다.
 */

const LOG_DIR = path.join(process.cwd(), "logs", "client-errors");
const RETENTION_DAYS = 7;
const SWEEP_INTERVAL_MS = 60 * 60 * 1_000;

let lastSweepAt = 0;

/** KST 기준 YYYY-MM-DD. 팀이 한국에서 보는 로그라 날짜 경계도 한국 시각을 따른다. */
function kstDateStamp(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

async function sweepOldLogs(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  const names = await readdir(LOG_DIR);
  const cutoff = now - RETENTION_DAYS * 24 * 60 * 60 * 1_000;
  for (const name of names) {
    const file = path.join(LOG_DIR, name);
    const info = await stat(file);
    if (info.mtimeMs < cutoff) await unlink(file);
  }
}

export async function appendClientErrorLog(line: string): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_DIR + path.sep + `${kstDateStamp()}.log`, line + "\n", "utf8");
    await sweepOldLogs();
  } catch (error) {
    // 파일을 못 쓰는 상황(권한·디스크)에서도 수집 자체는 계속돼야 한다.
    console.error("[client-error] 파일 기록 실패", error);
  }
}
