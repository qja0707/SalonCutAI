"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BLOG_SECTION_ORDER } from "@/lib/api-client/types";
import { EXAMPLE_BLOG_RESULT } from "@/lib/example-blog-result";
import { cn } from "@/lib/utils";

/**
 * 랜딩 02번 섹션의 골든셋 예시 카드 — 실제 결과 형태(제목·도입·4섹션·마무리·
 * 해시태그) 그대로 보여준다. 폰 폭에서 전체를 다 펼치면 한 화면을 훌쩍
 * 넘겨서(실측 지적) 첫 화면 분량만 보이게 자르고 "더 보기"로 펼친다. PC는
 * 처음부터 전체를 보여준다 — lg: 에서 높이 제한을 푼다.
 */
export function BlogExampleCard() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "relative mx-auto mt-10 max-w-2xl rounded-lg border bg-card px-5 pt-8 pb-5 shadow-lg",
        !expanded && "max-h-[480px] overflow-hidden lg:max-h-none lg:overflow-visible",
      )}
    >
      <span className="absolute top-3 right-4 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
        예시
      </span>
      <div className="space-y-4">
        <div>
          <p className="pr-11 text-lg font-semibold">{EXAMPLE_BLOG_RESULT.title}</p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
            {EXAMPLE_BLOG_RESULT.intro}
          </p>
        </div>
        {BLOG_SECTION_ORDER.map((key) => {
          const section = EXAMPLE_BLOG_RESULT.sections[key];
          if (!section) return null;
          return (
            <div key={key}>
              <p className="text-sm font-medium">{section.heading}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {section.body}
              </p>
            </div>
          );
        })}
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {EXAMPLE_BLOG_RESULT.closing}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_BLOG_RESULT.hashtags.map((hashtag) => (
            <Badge key={hashtag} variant="secondary">
              #{hashtag.replace(/^#+/, "")}
            </Badge>
          ))}
        </div>
      </div>

      {!expanded && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center rounded-b-lg bg-gradient-to-t from-card via-card/95 to-transparent pt-12 pb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}
