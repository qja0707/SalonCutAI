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
import { useEffect, useRef, useState } from "react";
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
import { EXAMPLE_BLOG_RESULT } from "@/lib/example-blog-result";
import { PageShell } from "@/components/flow/page-shell";
import {
  StepNav,
  StepProgress,
  scrollIntoViewOnNarrow,
  stepVisibility,
} from "@/components/flow/step-flow";

const EXPECTED_SECONDS = 16;

/** 결과까지 포함한 단계 수. 진행 표시는 입력 3단계만 센다. */
const PHONE_STEPS = ["매장 정보", "이번 시술", "모발 상태"] as const;
const PHONE_INPUT_STEP_COUNT = 3;

/**
 * 목적지 색(Discussion #149 3번) — 네이버 블로그. 원색 #03C75A 는 흰 글자 대비
 * 2.25:1 로 버튼에 못 써서, 짙은 변형만 쓴다. 흰 글자 5.19:1, wash 위 4.68:1 —
 * 둘 다 WCAG AA 통과. 앱의 완료색 #00c471 과는 충분히 떨어져 있다(색 거리 88).
 */
const IDENTITY_INK = "#017E3B";
const IDENTITY_WASH = "#e4f8ed";

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
  // 폰 단계식(A안, Discussion #149 — 얼굴 교체와 같은 흐름)에서 지금 보여줄 단계.
  // 1~3 은 입력, 4 는 결과. lg 이상에서는 쓰이지 않는다 — 카드가 전부 렌더된다.
  const [phoneStep, setPhoneStep] = useState(1);
  const resultRef = useRef<HTMLDivElement>(null);

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
      setPhoneStep(PHONE_INPUT_STEP_COUNT + 1);
      scrollIntoViewOnNarrow(resultRef.current);
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

  /**
   * 만들기 버튼 하나를 두 자리에서 그린다 — 데스크톱은 입력 칼럼 끝, 폰은 하단 고정 바.
   * 얼굴 교체 화면과 같은 이유다: 폰에서 버튼이 화면 밖에 있는 것이 가장 답답한
   * 지점이었다(#149 — 실측 3.1화면 분량, 버튼이 2.7화면 아래).
   */
  const generateCta = (
    <Button
      className="w-full transition-[filter] hover:brightness-90 active:brightness-95"
      size="lg"
      style={{ backgroundColor: IDENTITY_INK }}
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
  );

  const stepReady: Record<number, boolean> = {
    1: true,
    2: isBlogFieldsReady(fields),
    3: true,
  };
  const stepHint: Record<number, string> = {
    1: "",
    2: "메인 시술 · 베이스 컷 · 디자인 포인트 · 고객이 겪던 불편을 채워주세요.",
    3: "",
  };

  // 대제목은 새 네이밍, 메뉴는 AI 블로그 글쓰기 — 역할 분리(8/17 원장님)
  return (
    <PageShell
      className="pb-28 lg:pb-10"
      width="5xl"
      title="📝 간단 블로그 글쓰기"
      description={
        <>
          빈칸만 채우면 네이버 블로그에 바로 붙여넣을 완성 후기가 나옵니다. 매장
          정보는 저장돼 다음부터는 더 빨라져요.
        </>
      }
      badge={
        <>
          <Badge
            variant="secondary"
            className="border-0"
            style={{ backgroundColor: IDENTITY_WASH, color: IDENTITY_INK }}
          >
            네이버 블로그
          </Badge>
          {label && <Badge variant="secondary">연결된 컨텍스트 · {label}</Badge>}
        </>
      }
    >
      <StepProgress step={phoneStep} steps={PHONE_STEPS} activeColor={IDENTITY_INK} />

      {/*
        요청 오류는 단계 게이트 밖에서 보여준다. 결과 칼럼(4단계) 안에 두면
        폰에서 입력 단계 도중 실패했을 때 오류가 숨겨진 칼럼에 찍혀 아무것도 안 보인다
        — 얼굴 교체 화면에서 같은 이유로 이미 고친 문제다.
      */}
      {requestError && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <BlogFields
            values={fields}
            onChange={setFields}
            disabled={requesting}
            phoneStep={phoneStep}
          />

          <div className={stepVisibility(PHONE_INPUT_STEP_COUNT, phoneStep)}>
            {generateCta}
            {!isBlogFieldsReady(fields) && (
              <p className="mt-3 text-sm text-muted-foreground">
                메인 시술 · 베이스 컷 · 디자인 포인트 · 고객이 겪던 불편을 채우면
                만들 수 있어요.
              </p>
            )}
          </div>
        </div>

        <div
          className={`space-y-4 ${stepVisibility(
            generationResult ? PHONE_INPUT_STEP_COUNT + 1 : PHONE_INPUT_STEP_COUNT,
            phoneStep,
          )}`}
          ref={resultRef}
        >
          <h2 className="text-base font-semibold">결과</h2>
          {requesting && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                {progressMessage(elapsedSeconds)}
              </AlertDescription>
            </Alert>
          )}
          {/*
            결과 예시(Discussion #149 제안 2) — EXAMPLE_BLOG_RESULT(골든셋 1번)를
            실제 결과와 완전히 같은 마크업으로 그린다. 1차 시안은 랜딩 문구를
            요약해 2~3줄만 보여줬는데 "블로그 글이라고 인지가 안 된다, 트위터도
            아니고"라는 지적을 받았다 — 실제 길이·구조(제목·도입·4섹션·마무리·
            해시태그) 그대로 보여줘야 인지가 된다.
          */}
          {!requesting && !generationResult && (
            <div className="relative space-y-4 rounded-lg border px-4 pt-7 pb-4">
              {/* 제목이 2줄로 꺾이면 배지가 글자를 가린다(실측) — 카드 자체에
                  여백을 더 줘서 배지 자리를 비워둔다. */}
              <span className="absolute top-2.5 right-3 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                예시
              </span>
              <div>
                <p className="pr-11 text-lg font-semibold">
                  {EXAMPLE_BLOG_RESULT.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">
                {EXAMPLE_BLOG_RESULT.closing}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_BLOG_RESULT.hashtags.map((hashtag) => (
                  <Badge key={hashtag} variant="secondary">
                    #{hashtag.replace(/^#+/, "")}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                필수 항목을 채우고 만들기를 누르면 직접 만든 글이 이 자리에 표시됩니다.
              </p>
            </div>
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

      {phoneStep <= PHONE_INPUT_STEP_COUNT && (
        <StepNav
          step={phoneStep}
          totalSteps={PHONE_INPUT_STEP_COUNT}
          canGoNext={stepReady[phoneStep]}
          nextHint={stepHint[phoneStep]}
          onPrev={() => setPhoneStep((n) => Math.max(1, n - 1))}
          onNext={() => setPhoneStep((n) => Math.min(PHONE_INPUT_STEP_COUNT, n + 1))}
          cta={generateCta}
          width="max-w-5xl"
        />
      )}

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
    </PageShell>
  );
}
