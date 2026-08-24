"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 폰 전용 단계식 진행 — 얼굴 교체 화면의 A안(원장님 확정 8/18)을 일반화한 것.
 * 원래 `components/face-swap-step-nav.tsx` 에 있었고, 블로그·숏츠에 먼저
 * 적용한 뒤(Discussion #149) 얼굴 교체도 이 공용 컴포넌트로 옮겼다. 세 화면이
 * 전부 같은 조작 방식을 쓴다 — 옛 파일은 삭제했다.
 *
 * 폰에서는 카드가 세로로 쌓여 화면이 계속 길어진다. 아래를 채우는 동안 위에서
 * 무엇이 빠졌는지 안 보이고, 만들기 버튼이 화면 밖에 있으면 다 채우고도 어디를
 * 눌러야 하는지 모른다(블로그 화면에서 실측: 3.1화면 분량, 버튼이 2.7화면 아래).
 * 한 번에 한 단계만 보여주고 진행을 위에 고정, 만들기는 하단에 고정한다.
 *
 * 데스크톱(lg+)은 입력 칼럼이 통째로 보이므로 단계로 나누지 않는다 — 두 컴포넌트
 * 모두 `lg:hidden` 이고, 호출부는 phoneStep 과 무관하게 lg 에서 카드를 전부 렌더한다.
 */

export function stepVisibility(step: number, current: number): string {
  return current === step ? "" : "hidden lg:block";
}

/**
 * 좁은 화면에서만 그 자리로 데려간다.
 *
 * 1024px 이상에서는 입력과 결과가 좌우로 나란히 있어 이미 눈에 들어온다. 그보다
 * 좁으면 단계가 순서대로 넘어가므로, 다음 단계로 넘어간 뒤에도 스크롤 위치가
 * 이전 단계에 남아 있으면 무엇이 바뀌었는지 안 보인다. 결과로 갈 때(만들기 클릭)와
 * 입력으로 돌아갈 때(얼굴 교체의 "같은 설정으로 다음 사진") 양쪽에 다 쓴다.
 */
export function scrollIntoViewOnNarrow(element: HTMLElement | null): void {
  if (!element || typeof window === "undefined") return;
  if (window.matchMedia("(min-width: 1024px)").matches) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

export function StepProgress({
  step,
  steps,
}: {
  /** 1부터 시작. steps.length 를 넘으면(결과 단계) "완료"로 표시한다 */
  step: number;
  /** 입력 단계 라벨. 결과 단계는 포함하지 않는다 */
  steps: readonly string[];
}) {
  const done = step > steps.length;

  return (
    <div className="mt-6 lg:hidden" aria-live="polite">
      <ol className="flex items-center gap-1.5" aria-label="진행 단계">
        {steps.map((_, index) => {
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
              {step}/{steps.length}
            </span>{" "}
            · {steps[step - 1]}
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
 * 바뀌면 어느 것이 진짜 실행인지 흐려진다. 결과 단계에서는 호출부가 이 컴포넌트
 * 자체를 렌더하지 않는다(그 화면은 자체 동작 버튼을 가진다).
 */
export function StepNav({
  step,
  totalSteps,
  canGoNext,
  nextHint,
  onPrev,
  onNext,
  cta,
  width = "max-w-6xl",
}: {
  step: number;
  totalSteps: number;
  canGoNext: boolean;
  nextHint?: string;
  onPrev: () => void;
  onNext: () => void;
  cta: React.ReactNode;
  /** 이 화면의 본문 컨테이너 폭과 맞춘다 — PageShell 에 준 width 와 같은 값을 넘긴다 */
  width?: string;
}) {
  const isLastInput = step === totalSteps;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur lg:hidden">
      <div className={cn("mx-auto px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]", width)}>
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
