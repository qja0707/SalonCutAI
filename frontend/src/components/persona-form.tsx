"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChipGroup } from "@/components/chip-group";
import {
  FASHION_STYLES,
  IMAGE_KEYWORDS,
  IMAGE_KEYWORDS_MAX,
  FACE_CONCERNS,
  CHARM_POINTS,
  PART_DIRECTIONS,
  RECENT_TREATMENTS,
  STYLING_TIME,
  HAIR_TOOLS,
  type PersonaAnswers,
} from "@/lib/style-taxonomy";

export function PersonaForm({
  value,
  onChange,
}: {
  value: PersonaAnswers;
  onChange: (next: PersonaAnswers) => void;
}) {
  function set<K extends keyof PersonaAnswers>(key: K, v: PersonaAnswers[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-5">
      <Field label="3. 현재 직업 혹은 주된 활동 분야">
        <Input
          value={value.occupation}
          onChange={(e) => set("occupation", e.target.value)}
          placeholder="예: 사무직, 대학생, 자영업 등"
        />
      </Field>

      <Field label="4. 오늘 방문을 통해 변화를 주고 싶은 '이유'는 무엇인가요?">
        <Textarea
          value={value.visitReason}
          onChange={(e) => set("visitReason", e.target.value)}
          placeholder="예: 이직을 앞두고 분위기 전환을 하고 싶어요"
        />
      </Field>

      <Field label="5. 평소 선호하는 패션 스타일은 무엇인가요?">
        <ChipGroup options={FASHION_STYLES} value={value.fashionStyle} onChange={(v) => set("fashionStyle", v)} />
      </Field>

      <Field
        label={`6. 이번 시술로 얻고 싶은 '나의 이미지' 키워드를 ${IMAGE_KEYWORDS_MAX}가지 골라주세요.`}
        hint={`${value.imageKeywords.length}/${IMAGE_KEYWORDS_MAX} 선택됨`}
      >
        <ChipGroup
          options={IMAGE_KEYWORDS}
          value={value.imageKeywords}
          onChange={(v) => set("imageKeywords", v)}
          max={IMAGE_KEYWORDS_MAX}
        />
      </Field>

      <Field label="7. 절대 피하고 싶은 이미지가 있다면 적어주세요.">
        <Textarea
          value={value.avoidImage}
          onChange={(e) => set("avoidImage", e.target.value)}
          placeholder="예: 너무 어려 보이는 느낌은 피하고 싶어요"
        />
      </Field>

      <Field label="8. 얼굴형이나 두상에서 평소 신경 쓰이는 부분이 있나요?">
        <ChipGroup options={FACE_CONCERNS} value={value.faceConcerns} onChange={(v) => set("faceConcerns", v)} />
      </Field>

      <Field label="9. 드러내고 싶은 나만의 매력 포인트는 무엇인가요?">
        <ChipGroup options={CHARM_POINTS} value={value.charmPoints} onChange={(v) => set("charmPoints", v)} />
      </Field>

      <Field label="10. 평소 가르마 방향은 어디인가요?">
        <ChipGroup
          options={PART_DIRECTIONS}
          value={value.partDirection ? [value.partDirection] : []}
          onChange={(v) => set("partDirection", v[0] ?? "")}
          multiple={false}
        />
      </Field>

      <Field label="11. 최근 2년 이내에 하신 시술을 모두 체크해 주세요.">
        <ChipGroup
          options={RECENT_TREATMENTS}
          value={value.recentTreatments}
          onChange={(v) => set("recentTreatments", v)}
        />
      </Field>

      <Field label="12. 평소 모발 손질(스타일링)에 투자할 수 있는 시간은 어느 정도인가요?">
        <ChipGroup
          options={STYLING_TIME}
          value={value.stylingTime ? [value.stylingTime] : []}
          onChange={(v) => set("stylingTime", v[0] ?? "")}
          multiple={false}
        />
      </Field>

      <Field label="13. 평소 사용하는 헤어 도구는 무엇인가요?">
        <ChipGroup options={HAIR_TOOLS} value={value.hairTools} onChange={(v) => set("hairTools", v)} />
      </Field>

      <p className="text-xs text-muted-foreground">
        14. 생각해두신 스타일이나 좋아하는 분위기의 사진이 있다면, 위 &ldquo;레퍼런스 사진으로&rdquo;에 바로
        업로드해주세요.
      </p>

      <Field label="15. 디자이너에게 하고 싶은 말씀이 있다면 자유롭게 적어주세요.">
        <Textarea
          value={value.messageToDesigner}
          onChange={(e) => set("messageToDesigner", e.target.value)}
          placeholder="자유롭게 적어주세요"
        />
      </Field>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <Label className="block">{label}</Label>
        {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
