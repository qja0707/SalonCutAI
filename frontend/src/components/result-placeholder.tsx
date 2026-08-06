import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ResultPlaceholder({
  title,
  meta,
}: {
  title: string;
  meta: string[];
}) {
  return (
    <div className="relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-primary/30 bg-[repeating-linear-gradient(45deg,var(--muted)_0,var(--muted)_1px,transparent_1px,transparent_14px)] p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {meta.map((m) => (
          <Badge key={m} variant="secondary" className="text-[11px] font-normal">
            {m}
          </Badge>
        ))}
      </div>
      <Badge className="absolute bottom-3 left-3 bg-foreground text-background text-[10px]">
        AI 생성 이미지 (자리 표시)
      </Badge>
    </div>
  );
}
