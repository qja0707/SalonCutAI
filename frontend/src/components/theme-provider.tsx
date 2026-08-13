"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * next-themes 를 감싸는 얇은 래퍼.
 *
 * layout.tsx 는 서버 컴포넌트라 클라이언트 컨텍스트를 직접 넣을 수 없다.
 * 래퍼를 따로 두면 layout 은 서버 컴포넌트로 남는다.
 *
 * globals.css 가 `@custom-variant dark (&:is(.dark *))` 로 클래스 기반이라
 * attribute 는 class 여야 한다. data-theme 로 두면 토큰이 하나도 안 걸린다.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // 테마를 바꾸는 순간 색이 하나씩 따라 변하는 것을 막는다.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
