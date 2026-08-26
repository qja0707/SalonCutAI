"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const THUMBNAIL_COUNT = 6;
/**
 * 클립 하나로 쓸 수 있는 길이. 상한은 서버가 받는 값과 같게 맞춘다(승원님 확정,
 * 클립당 5초·전체 30초). 전에는 상한이 없어 30초짜리 원본을 넣으면 클립 하나가
 * 30초가 됐다 — 숏폼인데 한 컷이 영상 전체 길이를 잡아먹는다.
 */
export const MIN_RANGE_SECONDS = 0.5;
export const MAX_RANGE_SECONDS = 5;

type ClipFilmstripProps = {
  file: File;
  startSec?: number;
  endSec?: number;
  disabled?: boolean;
  onRangeChange: (startSec: number, endSec: number) => void;
  onResetRange: () => void;
};

type PreviewState = {
  file: File;
  duration: number;
  thumbnails: string[];
  failed: boolean;
};

function waitForMediaEvent(
  video: HTMLVideoElement,
  eventName: "loadedmetadata" | "seeked",
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onReady = () => finish();
    const onError = () => finish(new Error("video decode failed"));
    const onAbort = () => finish(new Error("video decode cancelled"));
    const timer = window.setTimeout(
      () => finish(new Error("video decode timed out")),
      5_000,
    );

    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function frameBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("frame capture failed"))),
      "image/jpeg",
      0.72,
    );
  });
}

function drawCoverFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context || video.videoWidth === 0 || video.videoHeight === 0) {
    throw new Error("video frame is unavailable");
  }

  const sourceRatio = video.videoWidth / video.videoHeight;
  const targetRatio = canvas.width / canvas.height;
  let sourceWidth = video.videoWidth;
  let sourceHeight = video.videoHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    sourceWidth = video.videoHeight * targetRatio;
    sourceX = (video.videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = video.videoWidth / targetRatio;
    sourceY = (video.videoHeight - sourceHeight) / 2;
  }

  context.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

export function ClipFilmstrip({
  file,
  startSec,
  endSec,
  disabled = false,
  onRangeChange,
  onResetRange,
}: ClipFilmstripProps) {
  const [preview, setPreview] = useState<PreviewState>(() => ({
    file,
    duration: 0,
    thumbnails: [],
    failed: false,
  }));

  useEffect(() => {
    const controller = new AbortController();
    const videoUrl = URL.createObjectURL(file);
    const thumbnailUrls: string[] = [];
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = videoUrl;

    async function extractFrames() {
      await waitForMediaEvent(video, "loadedmetadata", controller.signal);
      if (!Number.isFinite(video.duration) || video.duration < MIN_RANGE_SECONDS) {
        throw new Error("video duration is unavailable");
      }

      const canvas = document.createElement("canvas");
      canvas.width = 90;
      canvas.height = 160;

      for (let index = 0; index < THUMBNAIL_COUNT; index += 1) {
        video.currentTime = Math.min(
          video.duration - 0.01,
          (video.duration * (index + 0.5)) / THUMBNAIL_COUNT,
        );
        await waitForMediaEvent(video, "seeked", controller.signal);
        drawCoverFrame(video, canvas);
        const url = URL.createObjectURL(await frameBlob(canvas));
        thumbnailUrls.push(url);
      }

      if (!controller.signal.aborted) {
        setPreview({
          file,
          duration: video.duration,
          thumbnails: [...thumbnailUrls],
          failed: false,
        });
      }
    }

    extractFrames().catch(() => {
      thumbnailUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
      if (!controller.signal.aborted) {
        setPreview({ file, duration: 0, thumbnails: [], failed: true });
      }
    });

    return () => {
      controller.abort();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(videoUrl);
      thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [file]);

  const currentPreview = preview.file === file ? preview : null;

  if (currentPreview?.failed) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-xs leading-5 text-muted-foreground">
        이 형식은 정밀 미리보기를 지원하지 않아요. 기존 앞·가운데·뒤 선택으로 계속
        만들 수 있습니다.
      </p>
    );
  }

  if (!currentPreview || currentPreview.thumbnails.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground">
        정밀 미리보기를 준비하고 있습니다.
      </p>
    );
  }

  const { duration, thumbnails } = currentPreview;
  const customRange = startSec !== undefined && endSec !== undefined;
  const rangeStart = customRange ? startSec : 0;
  const rangeEnd = customRange ? endSec : Math.min(duration, 2);
  const minGap = Math.min(MIN_RANGE_SECONDS, duration);
  const maxGap = Math.min(MAX_RANGE_SECONDS, duration);
  // 한쪽 손잡이를 끌 때 반대쪽은 그대로 두므로, 길이 상·하한은 양쪽에서 함께 건다.
  const clampStart = (value: number) =>
    Math.max(0, Math.max(rangeEnd - maxGap, Math.min(value, rangeEnd - minGap)));
  const clampEnd = (value: number) =>
    Math.min(duration, Math.min(rangeStart + maxGap, Math.max(value, rangeStart + minGap)));
  const startPercent = (rangeStart / duration) * 100;
  const endPercent = (rangeEnd / duration) * 100;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-1 overflow-hidden rounded-lg bg-muted">
        {thumbnails.map((url, index) => (
          // blob URL은 Next Image 최적화 대상이 아니며 컴포넌트 해제 시 직접 revoke한다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={`${index + 1}번째 구간 미리보기`}
            className="aspect-[9/16] h-auto w-full object-cover"
          />
        ))}
      </div>

      {customRange ? (
        <>
          <div className="relative h-11">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
              style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={rangeStart}
              disabled={disabled}
              aria-label="시작 지점"
              className="pointer-events-none absolute inset-0 h-11 w-full appearance-none bg-transparent accent-primary [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-11 [&::-moz-range-thumb]:w-5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-11 [&::-webkit-slider-thumb]:w-5"
              onChange={(event) =>
                onRangeChange(clampStart(Number(event.target.value)), rangeEnd)
              }
            />
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={rangeEnd}
              disabled={disabled}
              aria-label="끝 지점"
              className="pointer-events-none absolute inset-0 h-11 w-full appearance-none bg-transparent accent-primary [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-11 [&::-moz-range-thumb]:w-5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-11 [&::-webkit-slider-thumb]:w-5"
              onChange={(event) =>
                onRangeChange(rangeStart, clampEnd(Number(event.target.value)))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>시작 시간(초)</span>
              <Input
                type="number"
                inputMode="decimal"
                min={Math.max(0, rangeEnd - maxGap)}
                max={rangeEnd - minGap}
                step={0.1}
                value={rangeStart}
                disabled={disabled}
                className="h-11"
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  if (Number.isFinite(value)) {
                    onRangeChange(clampStart(value), rangeEnd);
                  }
                }}
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>끝 시간(초)</span>
              <Input
                type="number"
                inputMode="decimal"
                min={rangeStart + minGap}
                max={Math.min(duration, rangeStart + maxGap)}
                step={0.1}
                value={rangeEnd}
                disabled={disabled}
                className="h-11"
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  if (Number.isFinite(value)) {
                    onRangeChange(rangeStart, clampEnd(value));
                  }
                }}
              />
            </label>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            한 컷은 {MIN_RANGE_SECONDS}~{MAX_RANGE_SECONDS}초까지 쓸 수 있어요.
            손잡이가 겹치면 시작·끝 시간을 직접 입력해 조정할 수 있어요.
          </p>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {rangeStart.toFixed(1)}초 ~ {rangeEnd.toFixed(1)}초
              <span className="ml-1 font-medium text-foreground">
                ({(rangeEnd - rangeStart).toFixed(1)}초)
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onResetRange}
            >
              기본 구간으로 되돌리기
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onRangeChange(0, Math.min(duration, 2))}
        >
          직접 구간 선택
        </Button>
      )}
    </div>
  );
}
