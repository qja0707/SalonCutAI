import { Check } from "lucide-react";
import { IDENTITY_INK, IDENTITY_WASH } from "@/app/generate/shorts/shared";

const STEPS = ["영상 고르기", "자동 편집", "저장하기"] as const;

/**
 * 지금 어디까지 왔는지만 알려준다.
 *
 * 얼굴 교체·블로그가 쓰는 `StepNav`/`StepProgress` 와 달리 **이동 수단이 아니다**.
 * 숏폼은 카드 세 장을 세로로 펴서 스크롤만으로 다 보이므로, 폰에서 카드를 갈아끼우던
 * 로직(`phoneStep`)이 필요 없어졌다. 여기서는 눌러도 아무 일이 없다.
 */
export function ShortsSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-6 flex items-center gap-1 rounded-2xl border bg-card px-3 py-3 sm:gap-2 sm:px-5">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={
                  active
                    ? { backgroundColor: IDENTITY_INK, color: "#fff" }
                    : done
                      ? { backgroundColor: IDENTITY_WASH, color: IDENTITY_INK }
                      : undefined
                }
                aria-hidden
              >
                {done ? <Check className="h-3.5 w-3.5" /> : step}
              </span>
              <span
                className={`truncate text-[11px] sm:text-xs ${
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {step < STEPS.length && (
              <span className="h-px w-4 shrink-0 bg-border sm:w-8" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
