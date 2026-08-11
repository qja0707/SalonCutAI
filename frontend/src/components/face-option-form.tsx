"use client";

// 어떤 얼굴로 바꿀지 고르는 입력부 — 조합 3(참조) · 조합 5(옵션) 하이브리드
//
// 필드 이름은 백엔드로 나가는 payload 와 같은 snake_case 를 쓴다.
// 화면 상태에서 payload 로 넘어갈 때 이름을 바꾸면 그 지점이 버그 자리가 된다.
//
// 폼 상태는 두 모드의 값을 평평하게 함께 들고 있고, 전송 직전 buildFaceOption 에서
// 쓰는 쪽만 남기고 반대쪽을 null 로 만든다. 모드를 오갈 때 입력값이 날아가지 않게 하려는 것이다.
//
// 필수 3개는 고정 목록, 세부 3개는 직접 입력을 연다(8/11 확정). 이유는 face-taxonomy.ts 참고.
// blog-fields.tsx 의 OptionButtons 와 생김새는 비슷하지만, 여기는 "선택 안 함" 칩과
// 길이 상한이 있어 따로 둔다.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/chip-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getReferenceFaces } from "@/lib/api-client/client";
import {
  FACE_AGE_GROUPS,
  FACE_CUSTOM_MAX,
  FACE_ETHNICITIES,
  FACE_GENDERS,
  FACE_MAKEUPS,
  FACE_NONE_LABEL,
  FACE_SKIN_TYPES,
  FACE_STYLES,
} from "@/lib/face-taxonomy";
import type { FaceMode, FaceOption, ReferenceFace } from "@/lib/api-client/types";

export type FaceOptionValues = {
  mode: FaceMode;
  ethnicity: string;
  gender: string;
  age: string;
  face_style: string;
  skin_type: string;
  makeup: string;
  reference_face_id: string;
};

/** 기본값은 참조 모드다. 같은 손님 사진 여러 장에서 인물이 흔들리지 않는 쪽이라(수민님 8/11). */
export const EMPTY_FACE_VALUES: FaceOptionValues = {
  mode: "reference",
  ethnicity: "",
  gender: "",
  age: "",
  face_style: "",
  skin_type: "",
  makeup: "",
  reference_face_id: "",
};

/** 전송 직전 조립. 쓰지 않는 쪽은 반드시 null 이어야 서버 검증을 통과한다. */
export function buildFaceOption(values: FaceOptionValues): FaceOption {
  if (values.mode === "reference") {
    return {
      mode: "reference",
      reference: { reference_face_id: values.reference_face_id },
      prompt: null,
    };
  }
  return {
    mode: "prompt",
    reference: null,
    prompt: {
      ethnicity: values.ethnicity,
      gender: values.gender,
      age: values.age,
      face_style: values.face_style,
      skin_type: values.skin_type,
      makeup: values.makeup,
    },
  };
}

/** 참조는 얼굴 1개, 옵션은 필수 3개. 세부 3개는 비어도 빈 문자열로 전송한다. */
export function isFaceReady(values: FaceOptionValues): boolean {
  if (values.mode === "reference") return Boolean(values.reference_face_id);
  return Boolean(values.ethnicity && values.gender && values.age);
}

/** 필수 항목. 고정 목록에서만 고른다. */
function RequiredChoice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <ChipGroup
        options={options}
        value={value ? [value] : []}
        onChange={(next) => onChange(next[0] ?? "")}
        multiple={false}
      />
    </div>
  );
}

/**
 * 세부 항목. 추천 어휘 + 직접 입력.
 * "선택 안 함"을 칩으로 명시한다 — 고른 칩을 다시 눌러야 풀리는 방식은 눌러봐야 알 수 있다.
 */
function OptionalChoice({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const [customOpened, setCustomOpened] = useState(false);
  // 값이 추천 목록에 없으면 직접 입력한 값이므로 입력칸이 열려 있어야 한다.
  // 상태로만 두면 값과 어긋나므로 계산해서 쓴다.
  const showCustom = customOpened || (Boolean(value) && !options.includes(value));

  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={!value && !showCustom ? "default" : "outline"}
          onClick={() => {
            setCustomOpened(false);
            onChange("");
          }}
        >
          {FACE_NONE_LABEL}
        </Button>
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={value === option ? "default" : "outline"}
            onClick={() => {
              setCustomOpened(false);
              onChange(option);
            }}
          >
            {option}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={showCustom ? "default" : "outline"}
          onClick={() => {
            setCustomOpened(true);
            if (options.includes(value)) onChange("");
          }}
        >
          직접 입력
        </Button>
      </div>
      {showCustom && (
        <Input
          className="mt-2"
          placeholder={placeholder}
          maxLength={FACE_CUSTOM_MAX}
          value={options.includes(value) ? "" : value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function ReferencePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [faces, setFaces] = useState<ReferenceFace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await getReferenceFaces();
        if (!cancelled) setFaces(next);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "얼굴 목록을 불러오지 못했습니다.");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>;
  }

  if (!faces) {
    return (
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg sm:aspect-square sm:h-auto" />
        ))}
      </div>
    );
  }

  if (faces.length === 0) {
    return <p className="text-sm text-muted-foreground">고를 수 있는 얼굴이 아직 없습니다.</p>;
  }

  // 폰에서는 썸네일을 감춘다. 3열 격자가 86px까지 줄어들어 얼굴을 알아볼 수 없고,
  // 좁은 화면에서는 한 줄에 하나씩 라벨로 고르는 편이 누르기도 쉽다.
  return (
    <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
      {faces.map((face) => {
        const selected = face.id === value;
        return (
          <button
            key={face.id}
            type="button"
            aria-pressed={selected}
            // 같은 얼굴을 다시 누르면 선택을 푼다. 잘못 고른 뒤 되돌릴 길이 있어야 한다.
            onClick={() => onChange(selected ? "" : face.id)}
            className={cn(
              "overflow-hidden rounded-lg border-2 text-left transition-colors",
              selected ? "border-primary" : "border-border hover:border-foreground/20 sm:border-transparent",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={face.thumbnail_url}
              alt={face.label}
              className="hidden aspect-square w-full object-cover sm:block"
            />
            {/* 폰은 한 줄에 라벨·국적을 양끝으로, sm 이상은 좁은 칸이라 두 줄로 쌓는다. */}
            <span className="flex min-h-12 items-center justify-between gap-2 px-4 text-sm sm:min-h-0 sm:flex-col sm:items-start sm:gap-0 sm:px-2 sm:py-1.5 sm:text-xs sm:text-muted-foreground">
              <span>{face.label}</span>
              <span className="text-muted-foreground">{face.ethnicity}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FaceOptionForm({
  values,
  onChange,
  disabled = false,
}: {
  values: FaceOptionValues;
  onChange: (next: FaceOptionValues) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<FaceOptionValues>) => onChange({ ...values, ...patch });

  return (
    <fieldset disabled={disabled} className="space-y-5">
      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          variant={values.mode === "reference" ? "default" : "outline"}
          aria-pressed={values.mode === "reference"}
          onClick={() => set({ mode: "reference" })}
        >
          가상 얼굴 고르기
        </Button>
        <Button
          type="button"
          className="flex-1"
          variant={values.mode === "prompt" ? "default" : "outline"}
          aria-pressed={values.mode === "prompt"}
          onClick={() => set({ mode: "prompt" })}
        >
          옵션으로 만들기
        </Button>
      </div>

      {values.mode === "reference" ? (
        <div className="space-y-2">
          <ReferencePicker
            value={values.reference_face_id}
            onChange={(next) => set({ reference_face_id: next })}
          />
          <p className="text-xs text-muted-foreground">
            같은 얼굴을 고르면 사진이 여러 장이어도 같은 인물로 나옵니다.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">기본 (필수)</CardTitle>
              <CardDescription>세 가지를 모두 골라야 이미지를 만들 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RequiredChoice
                label="국적"
                options={FACE_ETHNICITIES}
                value={values.ethnicity}
                onChange={(next) => set({ ethnicity: next })}
              />
              <RequiredChoice
                label="성별"
                options={FACE_GENDERS}
                value={values.gender}
                onChange={(next) => set({ gender: next })}
              />
              <RequiredChoice
                label="연령대"
                options={FACE_AGE_GROUPS}
                value={values.age}
                onChange={(next) => set({ age: next })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">세부 (선택)</CardTitle>
              <CardDescription>
                추천 어휘에 없으면 직접 적으셔도 됩니다. 얼굴만 다시 그리므로 배경이나 헤어에
                대한 내용은 반영되지 않습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <OptionalChoice
                label="얼굴 스타일"
                options={FACE_STYLES}
                value={values.face_style}
                onChange={(next) => set({ face_style: next })}
                placeholder="예: 이목구비가 뚜렷한"
              />
              <OptionalChoice
                label="피부 타입"
                options={FACE_SKIN_TYPES}
                value={values.skin_type}
                onChange={(next) => set({ skin_type: next })}
                placeholder="예: 주근깨가 있는"
              />
              <OptionalChoice
                label="메이크업"
                options={FACE_MAKEUPS}
                value={values.makeup}
                onChange={(next) => set({ makeup: next })}
                placeholder="예: 코랄 톤 립"
              />
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            사진이 바뀌면 같은 옵션이어도 다른 얼굴이 나옵니다. 한 게시물에 여러 장을 쓰실 때는
            &ldquo;가상 얼굴 고르기&rdquo;를 쓰시는 편이 좋습니다.
          </p>
        </div>
      )}
    </fieldset>
  );
}
