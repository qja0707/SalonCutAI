"use client";

// 어떤 얼굴로 바꿀지 고르는 입력부 — 조합 3(참조) · 조합 5(옵션) 하이브리드
//
// 필드 이름은 백엔드로 나가는 payload 와 같은 snake_case 를 쓴다.
// 화면 상태에서 payload 로 넘어갈 때 이름을 바꾸면 그 지점이 버그 자리가 된다.
//
// 폼 상태는 두 모드의 값을 평평하게 함께 들고 있고, 전송 직전 buildFaceOption 에서
// 쓰는 쪽만 남기고 반대쪽을 null 로 만든다. 모드를 오갈 때 입력값이 날아가지 않게 하려는 것이다.
//
// 필수 3개도 세부 4개도 고정 목록에서만 고른다(8/12 확정). 이유는 face-taxonomy.ts 참고.
// blog-fields.tsx 의 OptionButtons 와 생김새는 비슷하지만, 여기는 "선택 안 함" 칩이
// 따로 있어 분리해 둔다.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/chip-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getReferenceFaces } from "@/lib/api-client/client";
import {
  FACE_AGE_GROUPS,
  FACE_ETHNICITIES,
  FACE_EXPRESSIONS,
  FACE_GENDERS,
  FACE_MAKEUPS,
  FACE_NONE_LABEL,
  FACE_SKIN_TONES,
  FACE_STYLES,
} from "@/lib/face-taxonomy";
import type { FaceMode, FaceOption, ReferenceFace } from "@/lib/api-client/types";

export type FaceOptionValues = {
  mode: FaceMode;
  ethnicity: string;
  gender: string;
  age: string;
  face_style: string;
  expression: string;
  skin_tone: string;
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
  expression: "",
  skin_tone: "",
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
      expression: values.expression,
      skin_tone: values.skin_tone,
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
 * 세부 항목. 고정 목록에서만 고른다.
 * "선택 안 함"을 칩으로 명시한다 — 고른 칩을 다시 눌러야 풀리는 방식은 눌러봐야 알 수 있다.
 */
function OptionalChoice({
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
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={!value ? "default" : "outline"}
          onClick={() => onChange("")}
        >
          {FACE_NONE_LABEL}
        </Button>
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={value === option ? "default" : "outline"}
            onClick={() => onChange(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * 필터 한 줄. "전체"가 기본이고, 후보는 하드코딩하지 않고 응답에서 뽑는다(#84 8.4 합의).
 * 백엔드가 얼굴을 더하거나 빼면 필터도 저절로 맞는다.
 */
function FaceFilterRow({
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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-muted-foreground">{label}</span>
      <Button
        type="button"
        size="xs"
        variant={value === "" ? "secondary" : "ghost"}
        onClick={() => onChange("")}
      >
        전체
      </Button>
      {options.map((option) => (
        <Button
          key={option}
          type="button"
          size="xs"
          variant={value === option ? "secondary" : "ghost"}
          onClick={() => onChange(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}

/** 등장 순서를 지키며 중복만 걷어낸다. Set 은 삽입 순서를 보존한다. */
function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)];
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
  // 32장을 그대로 나열하면 폰에서 32칸이다. 성별·연령대·국적으로 좁힌다.
  const [genderFilter, setGenderFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [ethnicityFilter, setEthnicityFilter] = useState("");

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

  const filtered = faces.filter(
    (face) =>
      (!genderFilter || face.gender === genderFilter) &&
      (!ageFilter || face.age_group === ageFilter) &&
      (!ethnicityFilter || face.ethnicity === ethnicityFilter),
  );

  // 폰에서는 썸네일을 감춘다. 3열 격자가 86px까지 줄어들어 얼굴을 알아볼 수 없고,
  // 좁은 화면에서는 한 줄에 하나씩 라벨로 고르는 편이 누르기도 쉽다.
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <FaceFilterRow
          label="성별"
          options={uniqueInOrder(faces.map((face) => face.gender))}
          value={genderFilter}
          onChange={setGenderFilter}
        />
        <FaceFilterRow
          label="연령대"
          options={uniqueInOrder(faces.map((face) => face.age_group))}
          value={ageFilter}
          onChange={setAgeFilter}
        />
        <FaceFilterRow
          label="국적"
          options={uniqueInOrder(faces.map((face) => face.ethnicity))}
          value={ethnicityFilter}
          onChange={setEthnicityFilter}
        />
      </div>

      {filtered.length === 0 ? (
        // 조합이 비는 것은 정상이다 — 예: 30대 + 일본인 얼굴은 아직 없다.
        // 목록이 잘못된 것처럼 보이지 않게, 조건에 해당하는 얼굴이 없다고 그대로 말한다.
        <p className="text-sm text-muted-foreground">
          이 조건에 맞는 얼굴이 아직 없습니다. 필터를 넓혀보세요.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          {filtered.map((face) => {
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
                {/* label 에 국적이 이미 들어 있어("한국인 20대 여성 A") 따로 표시하지
                    않는다 — #84 8.1에서 중복 표시는 프론트가 정리하기로 했다. */}
                <span className="flex min-h-12 items-center px-4 text-sm sm:min-h-0 sm:px-2 sm:py-1.5 sm:text-xs sm:text-muted-foreground">
                  {face.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
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
                고르지 않아도 됩니다. 얼굴만 다시 그리므로 배경이나 헤어에 대한 내용은
                반영되지 않습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <OptionalChoice
                label="얼굴 스타일"
                options={FACE_STYLES}
                value={values.face_style}
                onChange={(next) => set({ face_style: next })}
              />
              <OptionalChoice
                label="표정"
                options={FACE_EXPRESSIONS}
                value={values.expression}
                onChange={(next) => set({ expression: next })}
              />
              <OptionalChoice
                label="스킨 톤"
                options={FACE_SKIN_TONES}
                value={values.skin_tone}
                onChange={(next) => set({ skin_tone: next })}
              />
              <OptionalChoice
                label="메이크업"
                options={FACE_MAKEUPS}
                value={values.makeup}
                onChange={(next) => set({ makeup: next })}
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
