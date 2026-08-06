"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UploadDropzone } from "@/components/upload-dropzone";
import { ResultPlaceholder } from "@/components/result-placeholder";
import { sampleAvatarFile } from "@/lib/sample-assets";

type Slot = { label: string; result: File | null };

const MIN_SLOTS = 2;
const MAX_SLOTS = 4;

export default function ComparePage() {
  const [basePhoto, setBasePhoto] = useState<File | null>(null);
  const [slots, setSlots] = useState<Slot[]>([
    { label: "", result: null },
    { label: "", result: null },
    { label: "", result: null },
  ]);
  const [compared, setCompared] = useState(false);

  const baseUrl = basePhoto ? URL.createObjectURL(basePhoto) : null;

  function updateSlot(i: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    if (slots.length >= MAX_SLOTS) return;
    setSlots((prev) => [...prev, { label: "", result: null }]);
  }

  function removeSlot() {
    if (slots.length <= MIN_SLOTS) return;
    setSlots((prev) => prev.slice(0, -1));
  }

  function handleCompare() {
    if (!basePhoto) {
      toast.warning("먼저 기준 사진을 업로드하거나 예시 사진을 사용해주세요.");
      return;
    }
    setCompared(true);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">모델 비교</h1>
      </div>
      <p className="mt-2 max-w-xl text-muted-foreground">
        같은 사진을 여러 모델·설정으로 돌려서 나란히 비교합니다. Colab이나 HuggingFace에서 미리 뽑아둔
        결과가 있으면 업로드하고, 없으면 자리 표시로 구조만 봅니다.
      </p>
      <Badge variant="secondary" className="mt-3">팀 회의·의사결정용 화면 — R2 수민 실험 공유용</Badge>

      <Card className="mt-8">
        <CardHeader><CardTitle className="text-base">1. 기준 사진</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-[220px]">
            <UploadDropzone label="기준 사진" file={basePhoto} onChange={setBasePhoto} />
          </div>
          <Button variant="outline" size="sm" onClick={async () => setBasePhoto(await sampleAvatarFile())}>
            📷 예시 사진 사용
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">2. 비교할 조합</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={removeSlot} disabled={slots.length <= MIN_SLOTS}>− 줄이기</Button>
            <Button variant="outline" size="sm" onClick={addSlot} disabled={slots.length >= MAX_SLOTS}>+ 늘리기</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}>
            {slots.map((slot, i) => (
              <div key={i} className="space-y-2">
                <p className="text-sm font-medium">조합 {i + 1}</p>
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">모델 · 설정</Label>
                  <Input
                    placeholder={i === 0 ? "예: SD1.5 · strength 0.8" : "예: SDXL · strength 0.9"}
                    value={slot.label}
                    onChange={(e) => updateSlot(i, { label: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">실제 결과 이미지 (있으면 업로드)</Label>
                  <UploadDropzone label="결과 이미지" file={slot.result} onChange={(f) => updateSlot(i, { result: f })} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button className="mt-6 w-full" size="lg" onClick={handleCompare}>
        <Search className="h-4 w-4" /> 비교하기
      </Button>

      {compared && (
        <div className="mt-8">
          <h2 className="mb-4 text-base font-semibold">결과 비교</h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${slots.length + 1}, minmax(0, 1fr))` }}>
            <figure className="space-y-1.5">
              {baseUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={baseUrl} alt="기준 사진" className="aspect-square w-full rounded-lg border border-border object-cover" />
              )}
              <figcaption className="text-center text-xs text-muted-foreground">기준 사진</figcaption>
            </figure>
            {slots.map((slot, i) => {
              const label = slot.label || `조합 ${i + 1} (라벨 미입력)`;
              const resultUrl = slot.result ? URL.createObjectURL(slot.result) : null;
              return (
                <figure key={i} className="space-y-1.5">
                  {resultUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resultUrl} alt={label} className="aspect-square w-full rounded-lg border border-border object-cover" />
                  ) : (
                    <ResultPlaceholder title={label} meta={["아직 실제 결과 없음"]} />
                  )}
                  <figcaption className="text-center text-xs text-muted-foreground">
                    {label} {slot.result && "· 실제 결과"}
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            실제 결과를 업로드한 칸은 진짜 이미지, 비워둔 칸은 자리 표시입니다.
          </p>
        </div>
      )}

      <Card className="mt-10 bg-card/40">
        <CardHeader><CardTitle className="text-sm">사용법 (팀 확인용)</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          <p>1. Colab이나 HuggingFace Inference API로 모델 몇 개 돌려서 결과 이미지를 저장해둡니다.</p>
          <p>2. 이 페이지에서 조합마다 라벨(모델명·파라미터)을 적고, 저장해둔 결과 이미지를 업로드합니다.</p>
          <p>3. &lsquo;비교하기&rsquo;를 누르면 기준 사진 옆에 나란히 뜹니다 — 회의에서 그대로 화면 공유하면 됩니다.</p>
          <p>4. 아직 결과가 없는 조합은 라벨만 적고 결과 업로드를 비워두면 자리 표시로 나옵니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
