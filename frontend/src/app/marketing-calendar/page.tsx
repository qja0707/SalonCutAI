"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ImageIcon, NotebookPen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DevNote } from "@/components/dev-note";
import { cn } from "@/lib/utils";
import { MARKETING_CALENDAR, SEASON_STYLE, getCalendarMonth } from "@/lib/marketing-calendar";

export default function MarketingCalendarPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const data = getCalendarMonth(selectedMonth)!;

  const label = `${data.month}월 · ${data.theme}`;
  const imageHref = `/generate/image?${new URLSearchParams({ prompt: data.imagePrompt, label }).toString()}`;
  const blogHref = `/generate/blog?${new URLSearchParams({ topic: data.blogTopic, theme: data.theme, label }).toString()}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">📅 1년 마케팅 캘린더</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        한국 미용실 시장의 계절·명절·시험 시즌에 맞춘 12개월 마케팅 테마입니다. 달을 고르면 그 달의
        프로모션 아이디어가 뜨고, AI 이미지·블로그 생성 도구로 바로 이어서 만들 수 있어요.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {MARKETING_CALENDAR.map((m) => {
          const active = m.month === selectedMonth;
          const s = SEASON_STYLE[m.season];
          return (
            <button
              key={m.month}
              onClick={() => setSelectedMonth(m.month)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors",
                active ? "border-primary bg-primary/10 shadow-sm" : "border-border hover:bg-accent"
              )}
            >
              <span className="text-xs font-medium text-muted-foreground">{m.month}월</span>
              <span className="text-xl">{m.emoji}</span>
              <span
                className="mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: s.bg, color: s.text }}
              >
                {m.theme}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-10 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{data.emoji}</span>
              <div>
                <CardTitle className="text-base">
                  {data.month}월 · {data.theme}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{data.season} · {data.issue}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">추천 프로모션 · </span>
              {data.promotion}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.services.map((sv) => (
                <Badge key={sv} variant="secondary">{sv}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.hashtags.map((h) => (
                <Badge key={h} variant="outline">#{h}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href={imageHref}>
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <ImageIcon className="h-4 w-4" />
                  <CardTitle className="text-base">이달의 홍보 이미지 만들기</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  이 달 테마에 맞는 이미지 프롬프트를 채운 채로 AI 이미지 생성 도구로 이동해요.
                </p>
                <p className="mt-3 flex items-center gap-1 text-sm font-medium text-primary">
                  이미지 생성 도구로 이동 <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href={blogHref}>
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <NotebookPen className="h-4 w-4" />
                  <CardTitle className="text-base">이달의 블로그 글 만들기</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  이 달 테마에 맞는 글감을 채운 채로 AI 블로그 글 생성 도구로 이동해요.
                </p>
                <p className="mt-3 flex items-center gap-1 text-sm font-medium text-primary">
                  블로그 생성 도구로 이동 <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Link
          href={`/generate/caption?${new URLSearchParams({ context: data.promotion, label }).toString()}`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
        >
          이 달 프로모션으로 인스타 캡션도 만들어보기 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <DevNote
        guideExample="가이드 예시 ② · 텍스트 입력만 + 이미지 생성"
        owner="R5 혜리"
        engines={["/generate/image, /generate/blog, /generate/caption (범용 AI 콘텐츠 도구로 분리됨)"]}
        preserve=""
        change="이달의 홍보 이미지 + 블로그 글 + 인스타 캡션 (각 도구 페이지에서 생성)"
        steps={[
          "달을 클릭하면 src/lib/marketing-calendar.ts에서 해당 월의 테마·프롬프트·글감을 조회",
          "'이미지 생성 도구로 이동' / '블로그 생성 도구로 이동' 버튼이 prompt·topic·theme·label을 쿼리 파라미터로 구성",
          "/generate/image, /generate/blog 페이지가 useSearchParams()로 값을 읽어 입력창을 자동으로 채움",
          "실제 OpenAI/Gemini/HuggingFace 호출은 각 도구 페이지에서 이뤄짐 (이 페이지는 API를 직접 호출하지 않음)",
        ]}
        codeHint={`// 캘린더 데이터: src/lib/marketing-calendar.ts (월별 테마·프롬프트·글감)\n// 실제 생성은 /generate/image, /generate/blog, /generate/caption 도구 페이지에서 이뤄짐\n// (query string으로 prompt/topic/context를 넘겨 자동 채움)`}
      />
    </div>
  );
}
