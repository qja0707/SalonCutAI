"use client";

import { useEffect, useRef } from "react";

/**
 * 랜딩 03번 섹션의 자리표시자(그라디언트+재생 아이콘)를 실제 샘플 영상으로
 * 대체한 것 — 정적 자리표시자보다 실제로 도는 영상이 생동감이 있다(실측 지적).
 * 음소거 자동재생이라 `autoPlay` 만으로 대부분 브라우저에서 바로 돈다. 다만
 * `prefers-reduced-motion` 이면 첫 프레임에서 멈춘다 — 브라우저가 자동으로
 * 막아주지 않아서 직접 pause 한다.
 */
export function ShortsPreviewVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      videoRef.current?.pause();
    }
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
