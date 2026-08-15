"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * 서버가 받는 형식과 같아야 한다 — face-swap-jobs/route.ts 의 ALLOWED_IMAGE_TYPES.
 * 여기가 더 좁으면 올릴 수 있는 사진을 파일 선택창에서 막고,
 * 더 넓으면 고르게 해놓고 접수 단계에서 거절당한다. 둘 다 손님 쪽에서는 고장으로 보인다.
 */
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_LABEL = "JPG, PNG, WebP";

/** 아이폰 기본 촬영 포맷. 서버가 아직 안 받으므로 무엇을 하면 되는지까지 알려준다. */
const HEIC_TYPES = ["image/heic", "image/heif"];

function isHeic(file: File): boolean {
  return HEIC_TYPES.includes(file.type) || /\.(heic|heif)$/i.test(file.name);
}

export function UploadDropzone({
  label,
  file,
  onChange,
  disabled = false,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  /** 생성 진행 중 사진을 바꾸면 원본·결과 비교쌍이 어긋난다. 그동안 잠근다. */
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  // 렌더마다 새로 만들면 blob URL 이 계속 쌓인다. 파일이 바뀔 때만 만들고 쓰고 나면 돌려준다.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (disabled) return;
      const f = files?.[0];
      if (!f) return;
      if (isHeic(f)) {
        toast.warning(
          "아이폰 HEIC 사진은 아직 올릴 수 없어요. 설정 > 카메라 > 포맷을 '높은 호환성'으로 바꾸면 JPG로 찍힙니다.",
        );
        return;
      }
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast.warning(`${ACCEPTED_LABEL} 형식만 올릴 수 있어요.`);
        return;
      }
      setIsLandscape(false);
      onChange(f);
    },
    [onChange, disabled],
  );

  if (previewUrl) {
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={label}
            className="aspect-square w-full object-cover"
            // 가로·세로 판정은 실제로 그려진 크기에서 읽는다. 파일만 봐서는 알 수 없다.
            onLoad={(event) =>
              setIsLandscape(event.currentTarget.naturalWidth > event.currentTarget.naturalHeight)
            }
          />
          <Button
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 h-7 w-7"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {isLandscape && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              가로로 넓은 사진입니다. 세 규격 모두 위아래 여백이 크게 남아 홍보용으로 쓰기
              어려울 수 있어요. 가능하면 세로로 찍은 사진을 올려주세요.
            </span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center transition-colors",
        disabled
          ? "cursor-not-allowed opacity-60"
          : dragActive
            ? "cursor-pointer border-primary bg-primary/5"
            : "cursor-pointer hover:bg-accent/40"
      )}
    >
      <ImagePlus className="h-6 w-6 text-muted-foreground" />
      <p className="px-4 text-sm text-muted-foreground">{label}</p>
      <p className="px-4 text-xs font-medium text-muted-foreground">세로로 찍은 사진을 올려주세요</p>
      <p className="text-xs text-muted-foreground/70">
        클릭 또는 드래그해서 업로드 · {ACCEPTED_LABEL}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
