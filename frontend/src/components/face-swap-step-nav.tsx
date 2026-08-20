"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 폰 전용 단계식 진행 — A안(`docs/시안/mobile-a.html`, 원장님 확정 8/18).
 *
 * 폰에서는 카드 네 장이 세로로 쌓여 화면이 계속 길어졌다. 아래를 채우는 동안 위에서
 * 무엇이 빠졌는지 안 보이고, 2단계 선택(대분류 → 구체 항목)은 긴 화면에 묻혀 기능이
 * 있는 줄도 모르는 일이 실제로 있었다. 한 번에 한 단계만 보여주고 진행을 위에 고정한다.
 *
 * 데스크톱(lg+)은 입력 칼럼이 통째로 보이므로 단계로 나누지 않는다 — 두 컴포넌트 모두
 * `lg:hidden` 이고, 페이지는 `phoneStep` 과 무관하게 lg 에서 카드를 전부 렌더한다.
 * PC 배치는 이번 범위가 아니다(원장님 8/18: "PC는 그대로, 목업 보며 추후").
 */

/** 결과까지 포함한 단계 수. 진행 표시는 입력 4단계만 센다. */
export const PHONE_STEPS = ["시술 사진", "사진 활용 동의", "AI 모델", "이미지 옵션", "결과"] as const;
export const PHONE_INPUT_STEP_COUNT = 4;

export function FaceSwapStepProgress({ step }: { step: number }) {
  const done = step > PHONE_INPUT_STEP_COUNT;

  return (
    <div className="mt-6 lg:hidden" aria-live="polite">
      <ol className="flex items-center gap-1.5" aria-label="진행 단계">
        {Array.from({ length: PHONE_INPUT_STEP_COUNT }, (_, index) => {
          const n = index + 1;
          return (
            <li
              key={n}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                done || n < step
                  ? "bg-primary"
                  : n === step
                    ? "bg-primary/45"
                    : "bg-muted",
              )}
            />
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        {done ? (
          <span className="font-medium text-primary">완료</span>
        ) : (
          <>
            <span className="font-medium text-foreground">
              {step}/{PHONE_INPUT_STEP_COUNT}
            </span>{" "}
            · {PHONE_STEPS[step - 1]}
          </>
        )}
      </p>
    </div>
  );
}

/**
 * 하단 고정 이동 바.
 *
 * 마지막 입력 단계에서는 `다음` 대신 만들기 버튼(cta)을 그대로 놓는다 — 버튼이 두 번
 * 바뀌면 어느 것이 진짜 실행인지 흐려진다. 결과 단계에서는 바를 렌더하지 않는다(그 화면은
 * 자체 동작 버튼을 가진다).
 */
export function FaceSwapStepNav({
  step,
  canGoNext,
  nextHint,
  onPrev,
  onNext,
  cta,
}: {
  step: number;
  canGoNext: boolean;
  nextHint?: string;
  onPrev: () => void;
  onNext: () => void;
  cta: React.ReactNode;
}) {
  const isLastInput = step === PHONE_INPUT_STEP_COUNT;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur lg:hidden">
      <div className="mx-auto max-w-6xl px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {!canGoNext && nextHint && !isLastInput && (
          <p className="mb-2 text-center text-[11px] text-muted-foreground">{nextHint}</p>
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onPrev}
            disabled={step === 1}
            className="shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>
          {isLastInput ? (
            <div className="min-w-0 flex-1">{cta}</div>
          ) : (
            <Button
              type="button"
              onClick={onNext}
              disabled={!canGoNext}
              className="min-w-0 flex-1"
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
