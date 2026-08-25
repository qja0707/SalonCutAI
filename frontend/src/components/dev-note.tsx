"use client";

import { useState } from "react";
import { ChevronRight, Wrench } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PreserveChangeChips } from "@/components/preserve-change";
import { Badge } from "@/components/ui/badge";
import { SHOW_DEV_TOOLS } from "@/lib/public-preview";
import { cn } from "@/lib/utils";

export function DevNote({
  guideExample,
  owner,
  engines,
  preserve,
  change,
  codeHint,
  steps,
  livePrompt,
}: {
  guideExample: string;
  owner: string;
  engines: string[];
  preserve?: string;
  change?: string;
  codeHint: string;
  steps?: string[];
  /** 실제로 생성돼 LLM에 전달된 프롬프트 — 유저 화면에는 절대 노출하지 않고 여기서만 확인 */
  livePrompt?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!SHOW_DEV_TOOLS) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-10 border-t border-border pt-4">
      <CollapsibleTrigger className="flex min-h-12 w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground sm:min-h-0">
        <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        <Wrench className="h-3.5 w-3.5" />
        개발자 정보 (팀 확인용 — 실제 서비스엔 안 보입니다)
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4 rounded-lg border border-border bg-card/40 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">가이드 대응</p>
            <p className="text-sm font-medium">{guideExample}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">담당</p>
            <p className="text-sm font-medium">{owner}</p>
          </div>
        </div>
        {steps && steps.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">동작 과정 (요청 → 응답)</p>
            <ol className="space-y-1">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <PreserveChangeChips preserve={preserve} change={change} />
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">사용 엔진</p>
          <div className="flex flex-wrap gap-1.5">
            {engines.map((e) => (
              <Badge key={e} variant="outline" className="font-mono text-[11px] font-normal">
                {e}
              </Badge>
            ))}
          </div>
        </div>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
          <code>{codeHint}</code>
        </pre>
        {livePrompt && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              방금 실제로 LLM에 전달된 프롬프트 (유저 화면엔 노출 안 됨)
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[11px] whitespace-pre-wrap">
              <code>{livePrompt}</code>
            </pre>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
