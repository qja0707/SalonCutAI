"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function BeforeAfter({
  originalUrl,
  originalLabel = "업로드한 사진",
  after,
}: {
  originalUrl: string | null;
  originalLabel?: string;
  after: React.ReactNode;
}) {
  if (!originalUrl) return <div className="w-full">{after}</div>;
  return (
    <div className="grid grid-cols-2 gap-3">
      <figure className="space-y-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={originalUrl} alt={originalLabel} className="aspect-square w-full rounded-lg border border-border object-cover" />
        <figcaption className="text-center text-xs text-muted-foreground">{originalLabel}</figcaption>
      </figure>
      <div className="space-y-1.5">
        {after}
        <p className="text-center text-xs text-muted-foreground">결과</p>
      </div>
    </div>
  );
}

/**
 * 원본과 결과를 한 프레임에 겹쳐 두고 가운데 손잡이로 갈라 보는 비교 슬라이더.
 *
 * 나란히 놓기(BeforeAfter)는 "머리·배경이 그대로인지" 훑기에 좋고, 겹쳐 가르기는
 * "같은 자리의 얼굴만 바뀌었는지" 보기에 좋다. 얼굴 교체 결과는 원본과 구도가
 * 같아서 겹치기가 성립한다 — 구도가 다른 화면(스타일 상담)은 BeforeAfter 를 계속 쓴다.
 *
 * 두 이미지는 같은 비율·object-cover 로 그려 서버의 crop 결과와 대체로 정렬된다.
 * fit_pad 결과는 약간 어긋날 수 있는데, 경계가 뜨는지 보는 목적에는 지장이 없다.
 */
export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "올린 사진",
  afterLabel = "바꾼 결과",
  autoPlay = false,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  /**
   * 랜딩 히어로 전용 — 손대지 않아도 좌우로 천천히 왔다갔다 보여준다. 사용자가
   * 직접 드래그·키보드 조작하면 그 즉시 멈춘다. 실제 결과 비교 화면(얼굴 교체 등)은
   * 본인 사진을 직접 살펴봐야 하니 쓰지 않는다. `prefers-reduced-motion` 이면 돌지 않는다.
   */
  autoPlay?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(autoPlay);

  useEffect(() => {
    if (!autoPlaying) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let atRight = false;
    const id = setInterval(() => {
      atRight = !atRight;
      setPosition(atRight ? 78 : 22);
    }, 2200);
    return () => clearInterval(id);
  }, [autoPlaying]);

  function moveTo(clientX: number) {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, Math.round(ratio))));
  }

  return (
    <div
      ref={frameRef}
      role="slider"
      tabIndex={0}
      aria-label="원본과 결과 비교 위치"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={position}
      className="relative aspect-[4/5] cursor-ew-resize select-none overflow-hidden rounded-lg border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      // pan-y: 세로 스크롤은 브라우저에 맡기고 가로 움직임만 슬라이더가 가져간다.
      // touch-none 으로 다 뺏으면 폰에서 이 큰 프레임 위로 스크롤이 안 된다.
      style={{ touchAction: "pan-y" }}
      onPointerDown={(event) => {
        setAutoPlaying(false);
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event.clientX);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(event) => {
        setAutoPlaying(false);
        if (event.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 5));
        if (event.key === "ArrowRight") setPosition((p) => Math.min(100, p + 5));
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={beforeUrl} alt={beforeLabel} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <div
        className={cn("absolute inset-0", !dragging && "transition-[clip-path] duration-[1400ms] ease-in-out")}
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterUrl} alt={afterLabel} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        <span className="pointer-events-none absolute right-2 bottom-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          AI 생성
        </span>
      </div>

      {/* 경계선과 손잡이. 조작은 프레임 전체가 받으므로 여기는 그림만 그린다. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0",
          !dragging && "transition-[left] duration-[1400ms] ease-in-out",
        )}
        style={{ left: `${position}%` }}
      >
        <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90 shadow-[0_0_4px_rgba(0,0,0,0.4)]" />
        <div className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-700 shadow-md">
          <ChevronsLeftRight className="h-4 w-4" />
        </div>
      </div>

      {/* 손잡이가 라벨 위를 지나면 잠깐 숨겨 겹침을 피한다 */}
      {position > 24 && (
        <span className="pointer-events-none absolute top-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {beforeLabel}
        </span>
      )}
      {position < 76 && (
        <span className="pointer-events-none absolute top-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {afterLabel}
        </span>
      )}
    </div>
  );
}
