"use client";

import { cn } from "@/lib/utils";

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multiple = true,
  max,
}: {
  options: readonly T[];
  value: T[];
  onChange: (value: T[]) => void;
  multiple?: boolean;
  max?: number;
}) {
  function toggle(option: T) {
    const selected = value.includes(option);
    if (!multiple) {
      onChange(selected ? [] : [option]);
      return;
    }
    if (selected) {
      onChange(value.filter((v) => v !== option));
      return;
    }
    if (max && value.length >= max) return;
    onChange([...value, option]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              // 모바일에서는 터치 타깃 44px을 확보하고, sm 이상에서 기존 높이로 돌아간다.
              "inline-flex min-h-11 items-center rounded-full border px-4 py-1.5 text-sm transition-colors sm:min-h-0 sm:px-3",
              active
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
