"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 폰 전용 하단 고정 바 — 준비물(슬롯) 상태와 만들기 버튼을 엄지 거리에 둔다.
 *
 * 좁은 화면에서는 1~4 단계가 세로로 쌓여, 아래 단계를 채우는 동안 위에서 무엇이
 * 빠졌는지도, 만들기 버튼이 어디 있는지도 안 보인다. 슬롯 앱들(드랩아트)이 채움
 * 상태를 화면 어디서든 보이게 고정하는 이유다.
 *
 * 데스크톱(lg+)은 입력 칼럼이 통째로 보이므로 이 바를 렌더하지 않는다 — CSS 로만
 * 숨기지 않고 페이지 쪽에서 lg:hidden 을 준다. 바 높이만큼 본문 하단 여백(pb)을
 * 페이지가 함께 잡아야 마지막 카드가 바에 가려지지 않는다.
 */
export function FaceSwapSlotBar({
  slots,
  cta,
}: {
  slots: { label: string; done: boolean }[];
  cta: React.ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <ol className="flex shrink-0 items-center gap-1.5" aria-label="준비 상태">
          {slots.map((slot) => (
            <li
              key={slot.label}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
                slot.done
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {slot.done && <Check className="h-3 w-3" />}
              {slot.label}
            </li>
          ))}
        </ol>
        <div className="min-w-0 flex-1">{cta}</div>
      </div>
    </div>
  );
}
