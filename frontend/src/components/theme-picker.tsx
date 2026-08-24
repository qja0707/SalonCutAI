"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Palette } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { THEME_OPTIONS, type ThemeName } from "@/components/theme-provider";

/**
 * 서버에서는 false, 브라우저에서는 true.
 *
 * 고른 테마는 브라우저에만 있는 값이라 서버는 알 수 없다. 첫 렌더에서 그 값을 읽으면
 * 서버가 만든 HTML 과 어긋난다. 흔히 쓰는 mounted 플래그는 effect 안에서 setState 를
 * 해야 해서 react-hooks/set-state-in-effect 에 걸리므로, React 가 외부 값을 읽으라고
 * 만든 API 를 쓴다. 구독할 것이 없으므로 구독 해제 함수만 돌려준다.
 */
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * 아무 것도 고르지 않았을 때 next-themes 가 돌려주는 값. 테마 목록에는 없는 이름이라
 * 견본도 이름표도 붙지 않고, 팔레트 아이콘과 "기기 설정" 으로 풀린다.
 *
 * 마운트 전에도 이 값을 쓴다. Select 는 첫 렌더에 value 가 undefined 이면 그 인스턴스를
 * 평생 uncontrolled 로 취급하므로(@base-ui/utils useControlled), 값이 한 번이라도
 * 비면 나중에 문자열이 들어오는 순간 controlled 로 바뀌었다고 경고한다.
 */
const SYSTEM = "system";

export function ThemePicker() {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { theme, setTheme } = useTheme();

  /**
   * Select 는 하나만 그린다.
   *
   * 예전에는 마운트 전후로 다른 Select 를 반환했지만, 트리에서 같은 자리의 같은
   * 컴포넌트라 React 는 둘을 한 인스턴스로 잇는다. 그래서 value 없는 폴백이 먼저
   * 만들어지고 뒤이어 value 가 붙으면 uncontrolled → controlled 경고가 났다.
   * 이제 렌더 내내 value 가 문자열이므로 인스턴스는 처음부터 controlled 다.
   *
   * 마운트 전에는 여전히 고른 값을 모르는 것처럼 그린다. 서버가 만든 HTML 과 같아야
   * 하이드레이션이 어긋나지 않는다.
   */
  const value = mounted ? (theme ?? SYSTEM) : SYSTEM;
  const current = mounted
    ? THEME_OPTIONS.find((option) => option.value === value)
    : undefined;

  return (
    <Select
      value={value}
      onValueChange={(next) => next && setTheme(next as ThemeName)}
      // 어떤 테마인지 모르는 동안은 누르지 못하게 한다.
      disabled={!mounted}
    >
      <SelectTrigger
        className="w-[52px] shrink-0"
        aria-label={`화면 색 · 현재 ${current?.label ?? "기기 설정"}`}
      >
        <SelectValue>
          <Swatch swatch={current?.swatch} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {THEME_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-2">
              <Swatch swatch={option.swatch} />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * 색 견본 — 왼쪽 위가 바탕색, 오른쪽 아래가 포인트색.
 * 기기 설정을 따라가는 중이면 고른 값이 없으므로 팔레트 아이콘을 보여준다.
 */
function Swatch({ swatch }: { swatch?: readonly [string, string] }) {
  if (!swatch) return <Palette className="h-4 w-4" />;
  const [background, accent] = swatch;
  return (
    <span
      aria-hidden="true"
      className="block h-4 w-4 shrink-0 rounded-[4px] border border-border"
      style={{ background: `linear-gradient(135deg, ${background} 50%, ${accent} 50%)` }}
    />
  );
}
