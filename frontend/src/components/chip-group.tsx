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
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
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
