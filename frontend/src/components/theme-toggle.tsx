"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * 밝은 화면 · 어두운 화면 전환.
 *
 * 아이콘을 상태로 고르지 않고 `dark:` 클래스로 바꾼다. next-themes 는 첫 렌더에서
 * 테마를 모르기 때문에(서버에는 그 정보가 없다) 렌더 중에 테마를 읽으면 hydration 이
 * 어긋난다. 흔히 쓰는 mounted 플래그는 effect 안에서 setState 를 해야 해서
 * react-hooks/set-state-in-effect 에 걸린다.
 *
 * 테마는 <html> 의 클래스로 이미 붙어 있으니 CSS 에 맡기면 둘 다 피할 수 있다.
 * 렌더 중에는 테마를 읽지 않고, 누를 때만 읽는다.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="밝은 화면과 어두운 화면 전환"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}
