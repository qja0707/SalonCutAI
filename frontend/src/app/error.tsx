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
 * "만들던 작업이 날아갔나"가 이 화면에서 사용자가 갖는 유일한 공포다. 얼굴 교체 job 은
 * 서버에 있고 새로고침 복구(active-job)도 되므로, 그 사실을 문구로 말해 안심시킨다.
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
        만들던 작업은 서버에 남아 있어요. 다시 시도를 누르면 이어서 볼 수 있고,
        진행 중이던 얼굴 교체는 화면에 다시 들어가면 이어받습니다.
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
