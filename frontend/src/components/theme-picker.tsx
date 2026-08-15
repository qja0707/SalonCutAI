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

export function ThemePicker() {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { theme, setTheme } = useTheme();

  // 첫 렌더에서는 어떤 테마인지 모른다. 자리만 잡아두고 누르지 못하게 한다.
  if (!mounted) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[52px] shrink-0" aria-label="화면 색 고르기">
          <Palette className="h-4 w-4" />
        </SelectTrigger>
      </Select>
    );
  }

  const current = THEME_OPTIONS.find((option) => option.value === theme);

  return (
    <Select value={theme} onValueChange={(next) => next && setTheme(next as ThemeName)}>
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
