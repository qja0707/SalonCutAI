"use client";

import { useEffect, useRef, useState } from "react";
import {
  Captions,
  CheckCircle2,
  Download,
  Film,
  Info,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createVideoJob,
  deleteVideoJob,
  getVideoJob,
  videoJobUrl,
} from "@/lib/api-client/client";
import type {
  VideoClipOptions,
  VideoJobResponse,
  VideoRole,
  VideoSelection,
} from "@/lib/api-client/types";

type ClipDraft = VideoClipOptions & { id: string; file: File };
const MAX_FILE_BYTES = 80 * 1024 * 1024;
const MAX_TOTAL_BYTES = 320 * 1024 * 1024;

const ROLE_OPTIONS: { value: VideoRole; label: string; caption: string }[] = [
  { value: "before", label: "시술 전", caption: "시술 전, 오늘의 변화를 시작합니다" },
  { value: "process", label: "시술 과정", caption: "섬세하게 완성해 가는 시술 과정" },
  { value: "detail", label: "디테일", caption: "작은 디테일까지 꼼꼼하게" },
  { value: "after", label: "마무리", caption: "완성된 스타일을 확인해 보세요" },
];

const SELECTION_OPTIONS: { value: VideoSelection; label: string }[] = [
  { value: "start", label: "앞 2초" },
  { value: "center", label: "가운데 2초" },
  { value: "end", label: "뒤 2초" },
];

function defaultRole(index: number, total: number): VideoRole {
  if (index === 0) return "before";
  if (index === total - 1) return "after";
  return index % 2 ? "process" : "detail";
}

export function ShortsGenerator() {
  const [clips, setClips] = useState<ClipDraft[]>([]);
  const [job, setJob] = useState<VideoJobResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!job || !["queued", "processing"].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await getVideoJob(job.job_id);
        setJob(next);
        if (next.status === "failed") setError(next.error?.message || "영상 처리에 실패했습니다.");
      } catch (pollError) {
        setError(pollError instanceof Error ? pollError.message : "작업 상태를 확인하지 못했습니다.");
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files).filter((file) => file.type.startsWith("video/"));
    const available = Math.max(0, 8 - clips.length);
    const accepted: File[] = [];
    let totalBytes = clips.reduce((sum, clip) => sum + clip.file.size, 0);
    for (const file of selected.slice(0, available)) {
      if (file.size > MAX_FILE_BYTES || totalBytes + file.size > MAX_TOTAL_BYTES) continue;
      accepted.push(file);
      totalBytes += file.size;
    }
    setClips((current) => {
      const total = current.length + accepted.length;
      return [
        ...current,
        ...accepted.map((file, offset) => {
          const role = defaultRole(current.length + offset, total);
          return {
            id: crypto.randomUUID(),
            file,
            role,
            selection: "center" as const,
            caption: ROLE_OPTIONS.find((option) => option.value === role)?.caption || "",
          };
        }),
      ];
    });
    if (selected.length > accepted.length) setError("영상은 8개, 파일당 80MB, 전체 320MB까지 올릴 수 있습니다.");
    else setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function updateClip(id: string, changes: Partial<VideoClipOptions>) {
    setClips((current) => current.map((clip) => (clip.id === id ? { ...clip, ...changes } : clip)));
  }

  async function generate() {
    if (clips.length < 2) {
      setError("시술 전후 흐름을 위해 영상을 2개 이상 올려주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await createVideoJob(
        clips.map(({ file, role, selection, caption }) => ({
          file,
          options: { role, selection, caption },
        })),
      );
      setJob(await getVideoJob(created.job_id));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "영상 작업을 접수하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function reset() {
    if (job && !["queued", "processing"].includes(job.status)) {
      await deleteVideoJob(job.job_id).catch(() => undefined);
    }
    setJob(null);
    setClips([]);
    setError("");
  }

  const busy = submitting || job?.status === "queued" || job?.status === "processing";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">MVP · 시술 영상 자동 편집</Badge>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AI 숏츠 만들기</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            촬영한 시술 영상의 구간과 순서를 정하면 9:16 숏츠로 자동 편집하고, 감지된 얼굴을 흐리게 처리합니다.
          </p>
        </div>
        <Button onClick={generate} disabled={busy || clips.length < 2} className="sm:mt-1">
          {busy ? <LoaderCircle className="animate-spin" /> : <Film />}
          {busy ? "영상 만드는 중" : "숏츠 만들기"}
        </Button>
      </div>

      <Alert className="mb-6 border-primary/20 bg-primary/5 px-4 py-3">
        <ShieldCheck className="text-primary" />
        <AlertTitle>얼굴 블러는 기본 적용됩니다</AlertTitle>
        <AlertDescription>
          자동 검출이 놓치는 얼굴이 있을 수 있으므로 완성 영상을 반드시 확인한 뒤 게시해주세요. 원본과 결과는 24시간 후 삭제됩니다.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <Info />
          <AlertTitle>확인이 필요합니다</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. 영상 업로드</CardTitle>
              <CardDescription>MP4·MOV·WEBM·MKV 파일을 2~8개 올려주세요. 파일당 80MB, 전체 320MB까지 지원합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy || clips.length >= 8}
                className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="mb-3 h-8 w-8 text-primary" />
                <span className="font-medium">영상을 선택하거나 추가하세요</span>
                <span className="mt-1 text-xs text-muted-foreground">선택한 순서는 아래에서 역할별로 다시 정리됩니다</span>
              </button>
              <Input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                multiple
                className="hidden"
                onChange={(event) => addFiles(event.target.files)}
              />
            </CardContent>
          </Card>

          {clips.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>2. 컷 역할·구간·자막</CardTitle>
                <CardDescription>역할 순서대로 자동 연결하며, 자막은 바로 수정할 수 있습니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {clips.map((clip, index) => (
                  <div key={clip.id} className="rounded-xl border bg-card p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{index + 1}. {clip.file.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{(clip.file.size / 1024 / 1024).toFixed(1)}MB</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        onClick={() => setClips((current) => current.filter((item) => item.id !== clip.id))}
                        aria-label={`${clip.file.name} 제거`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`role-${clip.id}`}>컷 역할</Label>
                        <select
                          id={`role-${clip.id}`}
                          value={clip.role}
                          disabled={busy}
                          onChange={(event) => {
                            const role = event.target.value as VideoRole;
                            updateClip(clip.id, {
                              role,
                              caption: ROLE_OPTIONS.find((option) => option.value === role)?.caption || clip.caption,
                            });
                          }}
                          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        >
                          {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`selection-${clip.id}`}>사용 구간</Label>
                        <select
                          id={`selection-${clip.id}`}
                          value={clip.selection}
                          disabled={busy}
                          onChange={(event) => updateClip(clip.id, { selection: event.target.value as VideoSelection })}
                          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        >
                          {SELECTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`caption-${clip.id}`} className="flex items-center gap-2"><Captions className="h-4 w-4" />자막</Label>
                      <Input
                        id={`caption-${clip.id}`}
                        value={clip.caption}
                        maxLength={80}
                        disabled={busy}
                        onChange={(event) => updateClip(clip.id, { caption: event.target.value })}
                      />
                    </div>
                  </div>
                ))}
                {clips.length < 8 && (
                  <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
                    <Plus />영상 추가
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        <aside>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>3. 결과 확인</CardTitle>
              <CardDescription>세로형 무음 MP4로 생성됩니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {job?.status === "completed" ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl bg-black">
                    <video className="aspect-[9/16] w-full" controls playsInline src={videoJobUrl(job.job_id)} />
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2 text-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />영상 생성 완료</p>
                    <p className="mt-2">길이 {job.result?.duration_sec.toFixed(1)}초 · 처리 {job.meta?.processing_sec.toFixed(1)}초</p>
                    <p className="mt-1">얼굴 검출·블러 {job.meta?.faces_blurred ?? 0}회</p>
                  </div>
                  <a
                    href={videoJobUrl(job.job_id)}
                    download="saloncutai-shorts.mp4"
                    className={buttonVariants({ className: "w-full" })}
                  >
                    <Download />MP4 다운로드
                  </a>
                  <Button variant="outline" className="w-full" onClick={reset}>새 영상 만들기</Button>
                </div>
              ) : busy && job ? (
                <div className="py-10 text-center">
                  <LoaderCircle className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                  <p className="font-medium">영상을 편집하고 있습니다</p>
                  <p className="mt-2 text-xs text-muted-foreground">브라우저를 닫지 말고 잠시 기다려주세요</p>
                  <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(4, job.progress)}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{job.progress}%</p>
                </div>
              ) : (
                <div className="flex aspect-[9/16] flex-col items-center justify-center rounded-2xl bg-muted/50 px-6 text-center">
                  <Film className="mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium">완성 영상이 여기에 표시됩니다</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">영상 2개 이상을 올리고 컷 설정을 확인한 뒤 숏츠 만들기를 눌러주세요.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
