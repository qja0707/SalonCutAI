"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * next-themes 를 감싸는 얇은 래퍼.
 *
 * layout.tsx 는 서버 컴포넌트라 클라이언트 컨텍스트를 직접 넣을 수 없다.
 * 래퍼를 따로 두면 layout 은 서버 컴포넌트로 남는다.
 *
 * globals.css 가 클래스 기반(`@custom-variant dark`)이라 attribute 는 class 여야 한다.
 * data-theme 로 두면 토큰이 하나도 안 걸린다.
 */

/**
 * 고를 수 있는 테마.
 *
 * `light`/`dark` 는 지금까지 쓰던 토스 블루이고 **기본값이다.** 색 변경은 팀 합의
 * 사항이라, 아무 것도 고르지 않은 사람에게는 화면이 그대로 보여야 한다.
 * 기기 설정 따라가기도 이 둘로 풀린다 — next-themes 는 시스템 설정을
 * `light` 아니면 `dark` 로만 해석하므로 두 이름이 목록에 있어야 동작한다.
 *
 * 나머지 넷은 후보다. 골라야만 바뀐다.
 *
 * swatch 는 [바탕색, 포인트색] 두 칸이다. 바탕만 보면 흰색끼리 구분이 안 되고
 * 포인트만 보면 밝고 어두움이 안 보인다.
 */
export const THEME_OPTIONS = [
  { value: "light", label: "토스 블루", swatch: ["#ffffff", "#3182f6"] },
  { value: "dark", label: "토스 블루 다크", swatch: ["#10151c", "#4593fc"] },
  { value: "ivory", label: "따뜻한 아이보리", swatch: ["#f4ede6", "#96243f"] },
  { value: "brick", label: "밝은 아이보리", swatch: ["#fcfbf8", "#8e2318"] },
  { value: "charcoal", label: "차콜", swatch: ["#17120f", "#d9647e"] },
  { value: "midnight", label: "미드나잇", swatch: ["#14161c", "#c9a227"] },
] as const;

export type ThemeName = (typeof THEME_OPTIONS)[number]["value"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={THEME_OPTIONS.map((option) => option.value)}
      // 테마를 바꾸는 순간 색이 하나씩 따라 변하는 것을 막는다.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
