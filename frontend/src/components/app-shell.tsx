"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scissors } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const customerItems = NAV_ITEMS.filter((i) => i.section === "customer");
  const toolsItems = NAV_ITEMS.filter((i) => i.section === "tools");
  const teamItems = NAV_ITEMS.filter((i) => i.section === "team");

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
            <span className="text-muted-foreground font-normal">마케팅 서비스</span>
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {customerItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        <Separator className="my-4" />
        <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          AI 콘텐츠 도구
        </p>
        <nav className="flex flex-col gap-1">
          {toolsItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        <Separator className="my-4" />
        <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          팀 확인용
        </p>
        <nav className="flex flex-col gap-1">
          {teamItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        <div className="mt-auto px-3 pt-6 text-xs text-muted-foreground">
          R5 혜리 작업 중 · 프로토타입
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <span className="font-semibold text-sm">💇 미용실 AI 마케팅 서비스</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
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
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
