"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, NotebookPen, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DevNote } from "@/components/dev-note";
import { copyBlogResult } from "@/lib/api-client/blog-content";
import { createBlogJob, deleteBlogJob, getBlogJob, retryBlogJob } from "@/lib/api-client/client";
import type { BlogJobResponse, BlogMockScenario } from "@/lib/api-client/types";
import { IS_PUBLIC_PREVIEW } from "@/lib/public-preview";
import {
  BlogFields,
  EMPTY_BLOG_FIELDS,
  buildBlogPayload,
  isBlogFieldsReady,
  useBlogProfile,
  type BlogFieldValues,
} from "./blog-fields";

const TERMINAL = new Set(["completed", "failed"]);
const EXPECTED_SECONDS = 16;

function progressMessage(elapsedSeconds: number): string {
  if (elapsedSeconds < 5) return "요청 내용을 확인하고 있어요";
  if (elapsedSeconds <= EXPECTED_SECONDS) return `블로그 초안을 작성하고 있어요 · ${elapsedSeconds}초`;
  return "평소보다 오래 걸리고 있어요";
}

export function BlogGenerator() {
  const searchParams = useSearchParams();
  const label = searchParams.get("label");
  const [fields, setFields] = useState<BlogFieldValues>(EMPTY_BLOG_FIELDS);
  const [scenario, setScenario] = useState<BlogMockScenario>("normal");
  const profile = useBlogProfile();

  const [requesting, setRequesting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<BlogJobResponse | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [requestError, setRequestError] = useState<string | null>(null);

  const jobStatus = job?.status;
  const active = Boolean(jobId && (!jobStatus || !TERMINAL.has(jobStatus)));
  const result = job?.status === "completed" ? job.result : null;

  useEffect(() => {
    if (!active || startedAt === null) return;
    const update = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);

  useEffect(() => {
    if (!jobId || (jobStatus && TERMINAL.has(jobStatus))) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await getBlogJob(jobId);
        if (!cancelled) setJob(next);
      } catch (error) {
        if (!cancelled) setRequestError(error instanceof Error ? error.message : "작업 상태를 불러오지 못했습니다.");
      }
    };
    void poll();
    const timer = window.setInterval(poll, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobId, jobStatus]);

  async function handleGenerate() {
    if (!isBlogFieldsReady(fields)) {
      toast.warning("메인 시술 · 베이스 컷 · 디자인 포인트 · 고객이 겪던 불편을 채워주세요.");
      return;
    }
    setRequesting(true);
    setRequestError(null);
    setJob(null);
    setJobId(null);
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    try {
      const created = await createBlogJob(buildBlogPayload(fields, profile), scenario);
      setJobId(created.job_id);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "작업을 시작하지 못했습니다.");
      setStartedAt(null);
    } finally {
      setRequesting(false);
    }
  }

  async function handleRetry() {
    if (!jobId) return;
    try {
      await retryBlogJob(jobId);
      setJob(await getBlogJob(jobId));
      setStartedAt(Date.now());
      setElapsedSeconds(0);
      toast.success("블로그 글을 다시 만들고 있어요.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "다시 시도하지 못했습니다.");
    }
  }

  async function handleDelete() {
    if (!jobId) return;
    try {
      await deleteBlogJob(jobId);
      setJobId(null);
      setJob(null);
      setStartedAt(null);
      setElapsedSeconds(0);
      toast.success("생성 결과를 삭제했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "결과를 삭제하지 못했습니다.");
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await copyBlogResult(result);
      toast.success("블로그 글을 클립보드에 복사했어요.");
    } catch {
      toast.error("블로그 글을 복사하지 못했습니다.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">📝 AI 블로그 글쓰기</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        이번 시술 정보를 입력하면 네이버 블로그에 바로 붙여넣을 수 있는 시술 후기를 만듭니다. 매장 정보는
        저장돼 다음부터는 채워진 상태로 시작합니다.
      </p>
      {label && <Badge variant="secondary" className="mt-3">연결된 컨텍스트 · {label}</Badge>}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <BlogFields values={fields} onChange={setFields} disabled={requesting || active} />

          {!IS_PUBLIC_PREVIEW && (
            <Card>
              <CardHeader><CardTitle className="text-base">개발용 mock 시나리오</CardTitle></CardHeader>
              <CardContent>
                <Select value={scenario} onValueChange={(value) => value && setScenario(value as BlogMockScenario)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">정상</SelectItem>
                    <SelectItem value="blog-fail">생성 실패 · 재시도 가능</SelectItem>
                    <SelectItem value="slow">느린 처리</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={requesting || active || !isBlogFieldsReady(fields)}
          >
            {requesting || active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {active ? progressMessage(elapsedSeconds) : "블로그 글 만들기"}
          </Button>
          {!isBlogFieldsReady(fields) && (
            <p className="text-sm text-muted-foreground">
              메인 시술 · 베이스 컷 · 디자인 포인트 · 고객이 겪던 불편을 채우면 만들 수 있어요.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-semibold">결과</h2>
          {requestError && <Alert variant="destructive"><AlertDescription>{requestError}</AlertDescription></Alert>}
          {active && (
            <Alert><Loader2 className="h-4 w-4 animate-spin" /><AlertDescription>{progressMessage(elapsedSeconds)}</AlertDescription></Alert>
          )}
          {result ? (
            <div className="space-y-4 rounded-lg border p-4">
              <div>
                <p className="text-lg font-semibold">{result.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{result.intro}</p>
              </div>
              {result.sections.map((section) => (
                <div key={section.heading}>
                  <p className="text-sm font-medium">{section.heading}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{section.body}</p>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">{result.closing}</p>
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map((hashtag) => <Badge key={hashtag} variant="secondary">#{hashtag.replace(/^#+/, "")}</Badge>)}
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" /> 블로그 글 전체 복사
              </Button>
            </div>
          ) : job?.status === "failed" ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <Alert variant="destructive"><AlertDescription>{job.error?.message}</AlertDescription></Alert>
                {job.error?.retryable && (
                  <Button variant="outline" onClick={handleRetry}><RotateCcw className="h-4 w-4" />다시 만들기</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
              <NotebookPen className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">왼쪽에서 시술 정보를 입력하고 생성하면 시술 후기가 여기 채워집니다.</p>
            </div>
          )}
          {job && TERMINAL.has(job.status) && (
            <Button variant="outline" size="sm" className="w-full" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />생성 결과 삭제
            </Button>
          )}
        </div>
      </div>

      <DevNote
        guideExample="MOCK-002 · 블로그 독립 job 종단 흐름"
        owner="카피·멀티모달 · 서비스·UI · 서빙·인프라 담당"
        engines={["Next.js Route Handler mock", "실제 제공자 연결은 후속 VM 프록시"]}
        preserve="마케팅 캘린더의 topic · theme · label 진입값"
        change="블로그 제목 · 도입 · 본문 섹션 · 마무리 · 해시태그"
        steps={["글감·톤·샵 소개를 /api/v1/blog-jobs에 전송", "2초마다 블로그 job 상태 확인", "완료 결과 표시와 전체 복사", "재시도 가능한 job 전체 재시도", "완료 뒤 결과 삭제 가능"]}
        codeHint={`// 얼굴 교체·블로그·영상은 각각 독립 job
// 서버 기본값 mock, 인증·HTTPS 준비 후 proxy 구현
// 기존 /api/generate-blog는 이번 작업에서 제거하지 않음`}
      />
    </div>
  );
}
