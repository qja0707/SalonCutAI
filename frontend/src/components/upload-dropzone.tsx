"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function UploadDropzone({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const previewUrl = file ? URL.createObjectURL(file) : null;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const f = files?.[0];
      if (f && f.type.startsWith("image/")) onChange(f);
    },
    [onChange]
  );

  if (previewUrl) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={label} className="aspect-square w-full object-cover" />
        <Button
          size="icon"
          variant="secondary"
          className="absolute right-2 top-2 h-7 w-7"
          onClick={() => onChange(null)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
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
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center transition-colors",
        dragActive ? "border-primary bg-primary/5" : "hover:bg-accent/40"
      )}
    >
      <ImagePlus className="h-6 w-6 text-muted-foreground" />
      <p className="px-4 text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/70">클릭 또는 드래그해서 업로드 · JPG, PNG</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
