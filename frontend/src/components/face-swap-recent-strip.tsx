"use client";

import { useEffect, useState } from "react";
import { getFaceSwapJob, isNotFoundError } from "@/lib/api-client/client";
import { readRecentJobs, removeRecentJob } from "@/lib/recent-jobs";
import type { FaceSwapJobResponse } from "@/lib/api-client/types";
import { cn } from "@/lib/utils";

/**
 * 오늘 만든 것들 스트립.
 *
 * 퇴근 후 여러 장을 몰아서 처리하면 직전 결과가 화면에서 밀려나는데, 서버에는
 * 24시간 남아 있다. 그 입구를 화면 하단에 상시로 둔다 — 누르면 그 작업의
 * 결과 화면을 다시 연다.
 *
 * 목록 API 는 없다. localStorage 의 번호들로 개별 조회를 돌려 그린다(8/14 승인 방식).
 * 서버에서 사라진 번호(404)는 그 자리에서 보관함에서도 지운다.
 */
export function FaceSwapRecentStrip({
  currentJobId,
  refreshToken,
  disabled = false,
  onSelect,
}: {
  currentJobId: string | null;
  /** 완료·삭제가 일어나면 부모가 올려서 다시 읽게 한다 */
  refreshToken: number;
  /** 생성 진행 중에는 화면 전환을 막는다 — 진행 중인 job 의 폴링이 끊긴다 */
  disabled?: boolean;
  onSelect: (job: FaceSwapJobResponse) => void;
}) {
  const [items, setItems] = useState<FaceSwapJobResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = readRecentJobs();
      if (saved.length === 0) {
        if (!cancelled) setItems([]);
        return;
      }
      const loaded = await Promise.all(
        saved.map(async (entry) => {
          try {
            const job = await getFaceSwapJob(entry.jobId);
            return job.status === "completed" ? job : null;
          } catch (error) {
            // 서버에서 사라진 번호는 보관함에서도 지운다. 통신 장애면 다음 갱신에 다시.
            if (isNotFoundError(error)) removeRecentJob(entry.jobId);
            return null;
          }
        }),
      );
      if (!cancelled) setItems(loaded.filter((job): job is FaceSwapJobResponse => job !== null));
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">오늘 만든 것들</h2>
        <p className="text-xs text-muted-foreground">결과는 완료 후 24시간 보관돼요</p>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {items.map((job) => {
          const viewing = job.job_id === currentJobId;
          return (
            <button
              key={job.job_id}
              type="button"
              disabled={disabled || viewing}
              onClick={() => onSelect(job)}
              className={cn(
                "shrink-0 space-y-1 text-center",
                disabled && !viewing && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "relative block h-24 w-24 overflow-hidden rounded-lg border-2 bg-muted transition-colors",
                  viewing ? "border-primary" : "border-border hover:border-foreground/30",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={job.results!["1:1"].url}
                  alt={`${new Date(job.updated_at).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}에 만든 홍보 이미지`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <span className="pointer-events-none absolute right-1 bottom-1 rounded bg-black/55 px-1 py-px text-[9px] font-medium text-white">
                  AI 생성
                </span>
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {viewing
                  ? "보는 중"
                  : new Date(job.updated_at).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
