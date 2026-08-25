"use client";

import { Check, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { FaceSwapJobResponse } from "@/lib/api-client/types";

/**
 * 대기 시간을 단계 이야기로 바꿔 보여준다.
 *
 * 한 줄 스피너는 "돌고는 있나?"라는 불안에 답하지 못한다. 사진 AI 앱들이 대기 화면에
 * 지금 하는 일을 단계로 풀어 보여주는 이유다 — 기다림의 길이는 못 줄여도
 * 기다림의 불확실성은 줄일 수 있다.
 *
 * 얼굴 교체 job 응답에는 progress 필드가 없다(서버 계약). 믿을 신호는
 * status(queued 면 queue_position 포함)와 경과 초뿐이다. 그래서 단계는 경과 초로
 * 추정만 하고 퍼센트 숫자는 약속하지 않는다 — 막대도 예상 시간 대비 감각만 주고
 * 94%에서 멈춰 "다 됐는데 안 끝나는" 거짓말을 피한다.
 *
 * 경과 초는 단계·막대를 움직이는 데만 쓰고 숫자로는 보여주지 않는다(8/25 원장님) —
 * 흐르는 초를 보고 있으면 기다리는 쪽이 초조해진다.
 */

/** 단계 전환·막대의 기준 시간. mock 기준 실측 평균이고 실서버 연결 후 재측정한다. */
export const EXPECTED_SECONDS = 16;

/** 이 시간을 넘기면 "오래 걸린다"고 인정하고, 새로고침해도 이어진다는 사실을 알린다. */
const LONG_RUNNING_SECONDS = EXPECTED_SECONDS * 2.5;

const STEPS = [
  { at: 0, label: "사진과 얼굴을 확인하고 있어요" },
  { at: 4, label: "새 얼굴을 만들어 자연스럽게 입히고 있어요" },
  { at: 11, label: "피드 · 스토리 3규격으로 다듬고 있어요" },
];

export function FaceSwapWaiting({
  job,
  elapsedSeconds,
}: {
  job: FaceSwapJobResponse | null;
  elapsedSeconds: number;
}) {
  // 줄을 서 있는 동안은 시계가 아니라 순번이 진실이다. 첫 단계에 묶어둔다.
  const queued = job?.status === "queued";
  const stepIndex = queued
    ? 0
    : STEPS.reduce((current, step, index) => (elapsedSeconds >= step.at ? index : current), 0);
  const percent = Math.min(94, Math.round((elapsedSeconds / EXPECTED_SECONDS) * 94));

  return (
    <Card>
      <CardContent className="space-y-4">
        <ol className="space-y-2.5">
          {STEPS.map((step, index) => {
            const state = index < stepIndex ? "done" : index === stepIndex ? "current" : "todo";
            return (
              <li key={step.label} className="flex items-center gap-2.5 text-sm">
                {state === "done" && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                {state === "current" && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </span>
                )}
                {state === "todo" && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  </span>
                )}
                <span className={state === "todo" ? "text-muted-foreground/60" : state === "done" ? "text-muted-foreground" : "font-medium"}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {queued && job?.queue_position
              ? `대기 순번 ${job.queue_position}번 · 차례가 오면 바로 시작해요`
              : "다 되면 이 화면에 바로 나타나요"}
          </p>
        </div>

        {elapsedSeconds > LONG_RUNNING_SECONDS && (
          <p className="text-xs text-muted-foreground">
            조금만 더 기다려 주세요. 창을 닫거나 새로고침해도 작업은 계속되고, 이
            화면에서 이어받을 수 있어요.
          </p>
        )}

        <p className="text-xs text-muted-foreground/80">
          헤어 · 의상 · 배경은 그대로 두고 얼굴만 바꿉니다.
        </p>
      </CardContent>
    </Card>
  );
}
