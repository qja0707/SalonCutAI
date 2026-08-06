"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { BeforeAfter } from "@/components/before-after";
import { ResultPlaceholder } from "@/components/result-placeholder";
import { DevNote } from "@/components/dev-note";
import { sampleSketchFile } from "@/lib/sample-assets";

const LENGTHS = ["숏", "미디움", "롱"];

export default function SketchConsultPage() {
  const [sketch, setSketch] = useState<File | null>(null);
  const [length, setLength] = useState(LENGTHS[1]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const sketchUrl = sketch ? URL.createObjectURL(sketch) : null;

  async function handleGenerate() {
    if (!sketch) {
      toast.warning("먼저 스케치 이미지를 업로드하거나 예시 스케치를 사용해주세요.");
      return;
    }
    setGenerating(true);
    // TODO(R2/R4): ControlNet Scribble 호출
    await new Promise((r) => setTimeout(r, 500));
    setGenerated(true);
    setGenerating(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">✏️ 스케치 상담</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        상담하면서 대략 그린 스케치를 실사 헤어 이미지로 바꿔드려요. &ldquo;머리 길이는 여기까지, 앞머리는
        이렇게&rdquo; — 그 자리에서 바로 보여줄 수 있습니다.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">여유가 될 때 도전하는 목표 기능이라, 지금은 스케치 파일 업로드로 대체되어 있습니다.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">1. 스케치</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <UploadDropzone label="스케치 이미지" file={sketch} onChange={setSketch} />
              <Button variant="outline" size="sm" className="w-full" onClick={async () => setSketch(await sampleSketchFile())}>
                ✏️ 예시 스케치로 체험하기 (미팅 시연용)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">2. 옵션</CardTitle></CardHeader>
            <CardContent>
              <Label className="mb-2 block">길이감</Label>
              <Select value={length} onValueChange={(v) => v && setLength(v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LENGTHS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            실사 이미지로 변환
          </Button>
        </div>

        <div>
          <h2 className="mb-4 text-base font-semibold">결과</h2>
          {!generated ? (
            <Card className="flex aspect-square items-center justify-center border-dashed">
              <p className="max-w-[220px] text-center text-sm text-muted-foreground">
                왼쪽에서 스케치를 올린 뒤 버튼을 누르면 결과가 여기 표시됩니다.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <BeforeAfter
                originalUrl={sketchUrl}
                originalLabel="업로드한 스케치"
                after={<ResultPlaceholder title="스케치 → 실사 변환" meta={[`길이감: ${length}`]} />}
              />
              <Button variant="outline" size="sm" className="w-full" disabled>
                <Download className="h-3.5 w-3.5" /> 이미지 다운로드 (모델 연동 후 활성화)
              </Button>
            </div>
          )}
        </div>
      </div>

      <DevNote
        guideExample="가이드 예시 ⑤ · 스케치 기반 생성"
        owner="R2 수민 · R4 영한 (여유 시)"
        engines={["ControlNet Scribble", "Diffusers"]}
        change="스케치 → 실사 전체"
        codeHint={`async function generate(sketch, length) {\n  // TODO(R2/R4): ControlNet Scribble 호출\n  // 캔버스 직접 그리기는 별도 캔버스 라이브러리로 교체 예정\n}`}
      />
    </div>
  );
}
