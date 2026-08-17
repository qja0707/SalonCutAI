"use client";

import { useEffect } from "react";
import { RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * 전역 오류 화면.
 *
 * 이 파일이 없으면 렌더 예외 하나에 앱 전체가 Next 기본 영문 화면으로 떨어진다
 * (상태 감사 G1). 여기서 잡으면 한국어로 상황을 말하고 그 자리에서 다시 시도할 수 있다.
 *
 * "만들던 작업이 날아갔나"가 이 화면에서 사용자가 갖는 유일한 공포다. 다만 이 화면은 세
 * 기능 어디서든 뜨는데 이어받기는 얼굴 교체만 된다. 그래서 안심 문구를 기능별로 나눈다.
 *
 *   얼굴 교체 — 서버 job + `active-job.ts` 의 localStorage 복구. 이어받는다
 *   숏츠     — 서버 job 이지만 저장이 프로세스 메모리(`backend/src/api/video_jobs.py` `_jobs`)
 *              이고 프론트에 job_id 를 남기지 않는다. 화면이 떨어지면 되찾을 길이 없다
 *   블로그   — 동기 호출(`createBlogJob` 이 결과를 바로 반환). 이어받을 작업 자체가 없다
 *
 * 셋 다 참인 범위로만 말한다 (PR #113 리뷰).
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // 사용자에게는 요약만 보여주고, 원인은 콘솔에 남겨 개발 중 재현을 돕는다.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-4xl">🙇</p>
      <h1 className="text-xl font-semibold tracking-tight">화면을 그리다 문제가 생겼어요</h1>
      <p className="text-sm text-muted-foreground">
        다시 시도를 누르면 보던 화면으로 돌아갑니다. 진행 중이던 얼굴 교체는 이어받고,
        블로그·숏츠는 이어받을 수 없어 다시 만들어 주셔야 해요.
      </p>
      <div className="mt-2 flex gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw className="h-4 w-4" />
          다시 시도
        </Button>
        <Link href="/">
          <Button variant="outline">
            <Home className="h-4 w-4" />
            홈으로
          </Button>
        </Link>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground/70">문의용 코드: {error.digest}</p>
      )}
    </div>
  );
}
