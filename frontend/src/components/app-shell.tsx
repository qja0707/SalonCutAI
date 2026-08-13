"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scissors } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import LoginButton from "./login-button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card/40 px-4 py-6">
        <div className="flex items-center gap-2 px-2 pb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Scissors className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm leading-tight">
            미용실 AI
            <br />
            <span className="text-muted-foreground font-normal">
              마케팅 서비스
            </span>
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={pathname === item.href}
            />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 pt-6">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <LoginButton mode="desktop" />
            </div>
            <ThemeToggle />
          </div>

          <div className="mt-auto px-3 pt-6 text-xs text-muted-foreground">
            서비스 UI · 프로토타입
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/*
          스크롤해도 남아 있어야 한다. /face-swap 폼이 길어서, 사진을 고르다 다른 메뉴로
          가려면 맨 위까지 되돌아가야 했다.
          bg-background 를 같이 주는 이유 — sticky 만 주면 스크롤한 본문이 헤더 뒤로 비친다.
        */}
        <header className="sticky top-0 z-40 border-b border-border bg-background md:hidden">
          <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            <nav
              aria-label="모바일 메뉴"
              className="flex flex-1 gap-2 overflow-x-auto"
            >
              <LoginButton mode="mobile" />

              {NAV_ITEMS.map((item) => (
                <MobileNavLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                />
              ))}
            </nav>

            {/* 메뉴는 가로로 스크롤되므로 토글은 밖에 둬야 밀려나지 않는다. */}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function MobileNavLink({
  item,
  active,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {item.label}
    </Link>
  );
}

function NavLink({
  item,
  active,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary/15 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
