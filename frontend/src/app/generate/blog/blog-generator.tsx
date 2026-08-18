"use client";

import { DevNote } from "@/components/dev-note";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copyBlogResult } from "@/lib/api-client/blog-content";
import { createBlogJob } from "@/lib/api-client/client";
import {
  BLOG_SECTION_ORDER,
  type BlogMockScenario,
  type BlogWireResult,
} from "@/lib/api-client/types";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BlogFields,
  EMPTY_BLOG_FIELDS,
  buildBlogPayload,
  isBlogFieldsReady,
  useBlogProfile,
  type BlogFieldValues,
} from "./blog-fields";
import { errorMessage } from "@/lib/api-client/error-message";

const EXPECTED_SECONDS = 16;

function progressMessage(elapsedSeconds: number): string {
  if (elapsedSeconds < 5) return "요청 내용을 확인하고 있어요";
  if (elapsedSeconds <= EXPECTED_SECONDS)
    return `블로그 초안을 작성하고 있어요 · ${elapsedSeconds}초`;
  return "평소보다 오래 걸리고 있어요";
}

export function BlogGenerator() {
  const searchParams = useSearchParams();
  const label = searchParams.get("label");
  const [fields, setFields] = useState<BlogFieldValues>(EMPTY_BLOG_FIELDS);
  const [scenario, setScenario] = useState<BlogMockScenario>("normal");
  const profile = useBlogProfile();

  const [requesting, setRequesting] = useState(false);

  const [generationResult, setGenerationResult] =
    useState<BlogWireResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (!requesting || startedAt === null) return;
    const update = () =>
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [requesting, startedAt]);

  async function handleGenerate() {
    if (!isBlogFieldsReady(fields)) {
      toast.warning(
        "메인 시술 · 베이스 컷 · 디자인 포인트 · 고객이 겪던 불편을 채워주세요.",
      );
      return;
    }
    setRequesting(true);
    setRequestError(null);

    setStartedAt(Date.now());
    setElapsedSeconds(0);
    try {
      const created = await createBlogJob(
        buildBlogPayload(fields, profile),
        scenario,
      );

      console.log("created:", created);
      setGenerationResult(created);
    } catch (error) {
      setRequestError(
        errorMessage(error, "글을 만들지 못했습니다. 잠시 후 다시 시도해주세요."),
      );
      setStartedAt(null);
    } finally {
      setRequesting(false);
    }
  }

  async function handleCopy() {
    if (!generationResult) return;

    try {
      await copyBlogResult(generationResult);
      toast.success("블로그 글을 클립보드에 복사했어요.");
    } catch {
      toast.error("블로그 글을 복사하지 못했습니다.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* 대제목은 새 네이밍, 메뉴는 AI 블로그 글쓰기 — 역할 분리(8/17 원장님) */}
      <h1 className="text-2xl font-semibold tracking-tight">
        📝 간단 블로그 글쓰기
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        빈칸만 채우면 네이버 블로그에 바로 붙여넣을 완성 후기가 나옵니다. 매장
        정보는 저장돼 다음부터는 더 빨라져요.
      </p>
      {label && (
        <Badge variant="secondary" className="mt-3">
          연결된 컨텍스트 · {label}
        </Badge>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <BlogFields
            values={fields}
            onChange={setFields}
            disabled={requesting}
          />

          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={requesting || !isBlogFieldsReady(fields)}
          >
            {requesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {requesting ? progressMessage(elapsedSeconds) : "블로그 글 만들기"}
          </Button>
          {!isBlogFieldsReady(fields) && (
            <p className="text-sm text-muted-foreground">
              메인 시술 · 베이스 컷 · 디자인 포인트 · 고객이 겪던 불편을 채우면
              만들 수 있어요.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-semibold">결과</h2>
          {requestError && (
            <Alert variant="destructive">
              <AlertDescription>{requestError}</AlertDescription>
            </Alert>
          )}
          {requesting && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                {progressMessage(elapsedSeconds)}
              </AlertDescription>
            </Alert>
          )}
          {generationResult && (
            <div className="space-y-4 rounded-lg border p-4">
              <div>
                <p className="text-lg font-semibold">
                  {generationResult.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {generationResult.intro}
                </p>
              </div>
              {BLOG_SECTION_ORDER.map((key) => {
                const section = generationResult.sections[key];
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
              <p className="text-sm text-muted-foreground">
                {generationResult.closing}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {generationResult.hashtags.map((hashtag) => (
                  <Badge key={hashtag} variant="secondary">
                    #{hashtag.replace(/^#+/, "")}
                  </Badge>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleCopy}
              >
                <Copy className="h-3.5 w-3.5" /> 블로그 글 전체 복사
              </Button>
            </div>
          )}
        </div>
      </div>

      <DevNote
        guideExample="MOCK-002 · 블로그 독립 job 종단 흐름"
        owner="카피·멀티모달 · 서비스·UI · 서빙·인프라 담당"
        engines={[
          "Next.js Route Handler mock",
          "실제 제공자 연결은 후속 VM 프록시",
        ]}
        preserve="마케팅 캘린더의 topic · theme · label 진입값"
        change="블로그 제목 · 도입 · 본문 섹션 · 마무리 · 해시태그"
        steps={[
          "글감·톤·샵 소개를 /api/v1/blog-jobs에 전송",
          "2초마다 블로그 job 상태 확인",
          "완료 결과 표시와 전체 복사",
          "재시도 가능한 job 전체 재시도",
          "완료 뒤 결과 삭제 가능",
        ]}
        codeHint={`// 얼굴 교체·블로그·영상은 각각 독립 job
// 서버 기본값 mock, 인증·HTTPS 준비 후 proxy 구현
// 기존 /api/generate-blog는 이번 작업에서 제거하지 않음`}
      />
    </div>
  );
}
