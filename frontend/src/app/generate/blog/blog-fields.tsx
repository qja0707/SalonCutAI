"use client";

// 블로그 12필드 입력부 — Discussion #53 설계안 기준
//
// 필드 이름은 백엔드 BlogGenerationRequest 와 같은 snake_case 를 쓴다.
// 화면 상태에서 payload 로 넘어갈 때 이름을 바꾸면 그 지점이 버그 자리가 된다.
//
// 12개 중 designer_name·region_keyword 는 폼이 들고 있지 않다.
// 매장 프로필(쿠키)이 원본이고, 전송 직전에 buildBlogPayload 로 합친다.
// 같은 값을 두 군데 두면 한쪽만 바뀌는 순간이 생긴다.

import { useMemo, useState, useSyncExternalStore } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DAMAGE_LEVELS,
  DURATION_MINUTES,
  HAIR_LENGTHS,
  HAIR_TEXTURES,
  HAIR_THICKNESSES,
  PAIN_POINT_EXAMPLES,
  REGION_BUSINESSES,
  TREATMENT_CATEGORIES,
  TREATMENT_DETAILS,
  buildRegionKeyword,
  formatDuration,
} from "@/lib/blog-taxonomy";
import {
  MAX_SPECIAL_PRODUCTS,
  getBlogProfileServerSnapshot,
  getBlogProfileSnapshot,
  subscribeBlogProfile,
  writeBlogProfile,
  type BlogProfile,
} from "@/lib/blog-profile";
import type { CreateBlogJobPayload } from "@/lib/api-client/types";
import { stepVisibility } from "@/components/flow/step-flow";

/** 폼이 직접 들고 있는 10개. 나머지 2개는 매장 프로필에서 온다. */
export type BlogFieldValues = {
  hair_length: string;
  hair_texture: string;
  hair_thickness: string;
  damage_level: string;
  customer_pain_point: string;
  base_cut: string;
  main_treatment: string;
  design_point: string;
  duration_minutes: string;
  special_product: string;
};

// 12필드 계약은 api-client/types.ts 가 정본이다. 여기서 다시 정의하면 두 벌이 된다.
export type { CreateBlogJobPayload } from "@/lib/api-client/types";

export const EMPTY_BLOG_FIELDS: BlogFieldValues = {
  hair_length: "",
  hair_texture: "",
  hair_thickness: "",
  damage_level: "",
  customer_pain_point: "",
  base_cut: "",
  main_treatment: "",
  design_point: "",
  duration_minutes: "",
  special_product: "",
};

/** 전송 직전에 폼 값과 매장 프로필을 합쳐 12필드를 만든다. 선택 미입력은 빈 문자열 그대로 간다. */
export function buildBlogPayload(values: BlogFieldValues, profile: BlogProfile): CreateBlogJobPayload {
  return {
    ...values,
    designer_name: profile.designerName,
    region_keyword: buildRegionKeyword(profile.regionArea, profile.regionBusiness),
  };
}

/** 필수 4개가 모두 채워졌는지. 선택 6개는 비어도 빈 문자열로 전송한다. */
export function isBlogFieldsReady(values: BlogFieldValues): boolean {
  return Boolean(
    values.main_treatment.trim() &&
      values.base_cut.trim() &&
      values.design_point.trim() &&
      values.customer_pain_point.trim(),
  );
}

/** 폼 밖(전송 시점)에서도 프로필을 읽어야 해서 훅으로 뺐다. */
export function useBlogProfile(): BlogProfile {
  return useSyncExternalStore(subscribeBlogProfile, getBlogProfileSnapshot, getBlogProfileServerSnapshot);
}

/**
 * 추천 보기값 버튼 + 직접 입력.
 * 보기값은 계약이 아니라 추천 어휘라, 목록에 없는 값도 그대로 전송된다(승원님 8/11 UI 보정 1).
 */
function OptionButtons({
  label,
  options,
  value,
  onChange,
  renderLabel = (option: string) => option,
  placeholder = "직접 입력",
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
  renderLabel?: (option: string) => string;
  placeholder?: string;
}) {
  const [customOpened, setCustomOpened] = useState(false);
  // 값이 추천 목록에 없으면 직접 입력한 값이므로 입력칸이 열려 있어야 한다.
  // 상태로 두면 값과 어긋나므로 계산해서 쓴다.
  const showCustom = customOpened || (Boolean(value) && !options.includes(value));

  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={value === option ? "default" : "outline"}
            onClick={() => {
              setCustomOpened(false);
              // 같은 값을 다시 누르면 선택 해제한다. 선택 필드는 비워둘 수 있어야 한다.
              onChange(value === option ? "" : option);
            }}
          >
            {renderLabel(option)}
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
          value={options.includes(value) ? "" : value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

export function BlogFields({
  values,
  onChange,
  disabled = false,
  phoneStep,
}: {
  values: BlogFieldValues;
  onChange: (next: BlogFieldValues) => void;
  disabled?: boolean;
  /**
   * 폰 단계식(StepFlow)에서 지금 보여줄 카드. 1=매장 정보, 2=이번 시술, 3=모발 상태.
   * 생략하면(데스크톱 전용 호출 등) 세 카드를 항상 함께 보여준다 — 기존 동작 그대로.
   */
  phoneStep?: number;
}) {
  const profile = useBlogProfile();
  const [productDraft, setProductDraft] = useState("");
  const [category, setCategory] = useState("");

  const set = (patch: Partial<BlogFieldValues>) => onChange({ ...values, ...patch });
  const cardVisible = (n: number) => (phoneStep === undefined ? "" : stepVisibility(n, phoneStep));
  const regionKeyword = buildRegionKeyword(profile.regionArea, profile.regionBusiness);

  const detailOptions = useMemo(
    () => (category ? (TREATMENT_DETAILS[category as keyof typeof TREATMENT_DETAILS] ?? []) : []),
    [category],
  );

  function addProduct() {
    const name = productDraft.trim();
    if (!name || profile.specialProducts.includes(name)) return;
    if (profile.specialProducts.length >= MAX_SPECIAL_PRODUCTS) return;
    writeBlogProfile({ ...profile, specialProducts: [...profile.specialProducts, name] });
    setProductDraft("");
  }

  function removeProduct(name: string) {
    writeBlogProfile({
      ...profile,
      specialProducts: profile.specialProducts.filter((item) => item !== name),
    });
    if (values.special_product === name) set({ special_product: "" });
  }

  return (
    <fieldset disabled={disabled} className="space-y-6">
      {/* ── 프로필 2개. 저장해두면 2회차부터 채워진 상태로 시작한다 ── */}
      <div className={cardVisible(1)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">매장 정보</CardTitle>
            <CardDescription>
              한 번 입력하면 이 브라우저에 저장돼, 다음부터는 채워진 상태로 시작합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">디자이너 이름</Label>
              <Input
                placeholder="예: 김서연"
                value={profile.designerName}
                onChange={(event) => writeBlogProfile({ ...profile, designerName: event.target.value })}
              />
            </div>

            <div>
              <Label className="mb-2 block">지역 · 업종</Label>
              <Input
                className="mb-2 w-40"
                placeholder="예: 성수동"
                value={profile.regionArea}
                onChange={(event) => writeBlogProfile({ ...profile, regionArea: event.target.value })}
              />
              <OptionButtons
                label="업종·시술"
                options={REGION_BUSINESSES}
                value={profile.regionBusiness}
                onChange={(next) => writeBlogProfile({ ...profile, regionBusiness: next })}
                placeholder="예: 두피케어"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                두 값을 합쳐 <span className="font-medium">{regionKeyword || "지역 + 업종"}</span> 으로 보냅니다.
                지역명만 있으면 지역 검색에 잡히지 않습니다.
              </p>
            </div>

            <div>
              <Label className="mb-2 block">취급 제품 (선택)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="예: 모로칸 오일"
                  value={productDraft}
                  onChange={(event) => setProductDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addProduct();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addProduct}>
                  <Plus className="h-4 w-4" />
                  추가
                </Button>
              </div>
              {profile.specialProducts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.specialProducts.map((product) => (
                    <span
                      key={product}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
                    >
                      {product}
                      <button type="button" onClick={() => removeProduct(product)} aria-label={`${product} 삭제`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                목록만 저장합니다. 글을 쓸 때 이번 시술에 실제로 쓴 제품을 아래에서 고릅니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 필수 4개. 없으면 글이 성립하지 않는다 ── */}
      <div className={cardVisible(2)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">이번 시술 (필수)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              {/* 대분류는 전송하지 않는다. 아래 구체 시술명(main_treatment)만 payload 로 나간다. */}
              <OptionButtons
                label="메인 시술"
                options={TREATMENT_CATEGORIES}
                value={category}
                onChange={(next) => {
                  setCategory(next);
                  set({ main_treatment: "" });
                }}
                placeholder="예: 두피케어"
              />
              {category && (
                <div className="mt-2">
                  <OptionButtons
                    label={`${category} — 구체 시술명`}
                    options={detailOptions}
                    value={values.main_treatment}
                    onChange={(next) => set({ main_treatment: next })}
                    placeholder="예: C컬 펌"
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="mb-2 block">베이스 컷</Label>
              <Input
                placeholder="예: 레이어드 컷"
                value={values.base_cut}
                onChange={(event) => set({ base_cut: event.target.value })}
              />
            </div>

            <div>
              <Label className="mb-2 block">디자인 포인트</Label>
              <Input
                placeholder="예: 얼굴형을 보완하는 C컬 볼륨"
                value={values.design_point}
                onChange={(event) => set({ design_point: event.target.value })}
              />
            </div>

            <div>
              <Label className="mb-2 block">고객이 겪던 불편</Label>
              <Textarea
                rows={3}
                placeholder="예: 모발이 얇고 힘이 없어 아침마다 정수리가 눌리고, 드라이에 20분 넘게 걸렸습니다"
                value={values.customer_pain_point}
                onChange={(event) => set({ customer_pain_point: event.target.value })}
              />
              {/* 손님은 문제로 검색한다("손상모 복구펌") — 고민이 문장으로 들어가야 그 검색이 걸린다.
                  칩은 시작 문장을 넣어줄 뿐이고, 손님 사례로 고쳐 쓰는 것이 목적이다. */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PAIN_POINT_EXAMPLES.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => set({ customer_pain_point: example.text })}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                글의 도입 문단이 이 내용만으로 채워집니다. 비워두면 AI가 지어냅니다.
                칩을 누른 뒤 손님 사례로 고쳐 쓰면 검색에 더 잘 걸립니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 선택 6개. 비워두면 빈 문자열로 전송한다(규범님 8/11) ── */}
      <div className={cardVisible(3)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">모발 상태 · 기타 (선택)</CardTitle>
            <CardDescription>고르지 않으면 해당 내용 없이 글을 만듭니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <OptionButtons
              label="기장"
              options={HAIR_LENGTHS}
              value={values.hair_length}
              onChange={(next) => set({ hair_length: next })}
            />
            <OptionButtons
              label="모질"
              options={HAIR_TEXTURES}
              value={values.hair_texture}
              onChange={(next) => set({ hair_texture: next })}
            />
            <OptionButtons
              label="굵기"
              options={HAIR_THICKNESSES}
              value={values.hair_thickness}
              onChange={(next) => set({ hair_thickness: next })}
            />
            <OptionButtons
              label="손상도"
              options={DAMAGE_LEVELS}
              value={values.damage_level}
              onChange={(next) => set({ damage_level: next })}
            />
            <OptionButtons
              label="소요 시간"
              options={DURATION_MINUTES}
              value={values.duration_minutes}
              onChange={(next) => set({ duration_minutes: next })}
              renderLabel={formatDuration}
              placeholder="숫자만 입력 (예: 150)"
            />

            {/* 프로필 목록에서 고르되, 목록에 없는 제품도 직접 입력할 수 있어야 한다. */}
            <div>
              <OptionButtons
                label="이번 시술에 사용한 제품"
                options={profile.specialProducts}
                value={values.special_product}
                onChange={(next) => set({ special_product: next })}
                placeholder="예: 올라플렉스 No.3"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {profile.specialProducts.length === 0
                  ? "위 매장 정보에 취급 제품을 등록하면 버튼으로 고를 수 있습니다."
                  : "고르지 않으면 제품을 쓰지 않은 것으로 봅니다."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </fieldset>
  );
}
