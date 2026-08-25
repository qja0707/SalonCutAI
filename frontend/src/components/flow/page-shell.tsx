"use client";

import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * 기능 화면의 바깥 껍데기 — 폭 · 여백 · 대제목 · 설명 · 안내를 한 곳에서 정한다.
 *
 * 왜 만들었나 — 같은 헤더가 화면마다 복사돼 있었다. `text-2xl font-semibold tracking-tight`
 * 한 줄이 10개 화면에 그대로 박혀 있었고, 설명 문단 최대폭만 `max-w-xl`/`max-w-2xl` 로
 * 제각각이었다. 제목 크기를 한 번 바꾸려면 열 군데를 고쳐야 했다.
 *
 * 폭(width)은 아직 화면마다 다르다. `max-w-5xl`/`6xl`/`7xl` 이 섞여 있는데, 이걸 한 번에
 * 통일하면 블로그가 넓어지고 숏츠가 좁아져 눈에 띄는 변화가 된다. 그래서 이 PR 에서는
 * **각 화면이 쓰던 값을 그대로 넘겨** 배치를 건드리지 않는다. 통일은 별도 PR 에서 이
 * prop 만 지우면 된다 (기본값이 이미 `6xl` — 얼굴 교체·랜딩 기준).
 *
 * 숏츠는 아직 쓰지 않는다. CTA 가 헤더 오른쪽에 붙는 등 모양이 달라서, 화면을
 * 재구성하는 PR 에서 함께 옮긴다. 배지 위치(제목 위)는 숏츠와 맞춰뒀다 — 배지가
 * 설명 아래 있던 1차 버전은 숏츠만 배지가 위에 있어 화면마다 배지 자리가
 * 달랐다(실측 지적).
 */

const WIDTH = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

export type PageShellWidth = keyof typeof WIDTH;

/**
 * 이 화면에 처음 온 게 아니면 true. 설명 문단이 매번 반복 노출되는 걸 막으려고
 * 만들었다 — 화면(pathname)별로 localStorage 에 방문 기록을 남긴다.
 *
 * 초깃값은 항상 false(첫 방문)로 서버 렌더와 맞춘다 — 마운트 시 바로 localStorage를
 * 읽어버리면, 서버는 window가 없어 항상 false를 렌더하는데 클라이언트 첫 렌더만
 * true가 돼서 하이드레이션 직후 "새로고침하면 에러(#418)"가 났다(실측 재현:
 * ynow98, PR #160). "읽기·쓰기" 둘 다 effect로 미뤄서 첫 페인트는 항상 서버와
 * 같게 하고, 재방문이면 그 직후 한 번만 상태를 바꾼다.
 */
function useReturningVisitor(pathname: string): boolean {
  const key = `pageshell-visited:${pathname}`;
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    let alreadyVisited = false;
    try {
      alreadyVisited = window.localStorage.getItem(key) !== null;
      window.localStorage.setItem(key, "1");
    } catch {
      // localStorage 를 막아둔 환경(프라이빗 모드 등)에서는 매번 첫 방문처럼 보여준다.
    }
    // 서버는 항상 false를 렌더하므로 하이드레이션 직후에만 true로 바꾼다 — 여기서
    // 안 바꾸면 재방문자에게 설명 문단이 계속 남는다. SSR-세이프 클라이언트 상태의
    // 표준 패턴이라 캐스케이딩 렌더링 경고보다 정확성을 우선한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (alreadyVisited) setReturning(true);
  }, [key]);

  return returning;
}

export function PageShell({
  title,
  icon: Icon,
  description,
  footnote,
  badge,
  notice,
  width = "6xl",
  className,
  children,
}: {
  title: React.ReactNode;
  /** 제목 앞에 붙는 아이콘. 이모지를 제목에 넣는 화면은 쓰지 않는다 (모델 비교만 사용) */
  icon?: LucideIcon;
  description?: React.ReactNode;
  /** 설명 아래 한 줄 더. 지금은 스케치 상담의 "목표 기능" 안내만 쓴다 */
  footnote?: React.ReactNode;
  /** 제목 위 배지(들). 숏츠와 같은 자리 — 여백은 여기서 잡으므로 호출부는 `mb-*` 를 붙이지 않는다 */
  badge?: React.ReactNode;
  /** 헤더 아래 항상 보이는 안내. 공개 미리보기 고지처럼 접히면 안 되는 것 */
  notice?: React.ReactNode;
  width?: PageShellWidth;
  /** 화면별 예외 여백. 폰 하단 고정 바가 있는 화면의 `pb-*` 같은 것 */
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReturningVisitor = useReturningVisitor(pathname);

  const heading = (
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
  );

  return (
    <div className={cn("mx-auto px-6 py-10", WIDTH[width], className)}>
      {badge && (
        <div className="mb-3 flex flex-wrap items-center gap-2">{badge}</div>
      )}

      {Icon ? (
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {heading}
        </div>
      ) : (
        heading
      )}

      {description && !isReturningVisitor && (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      )}
      {footnote && (
        <p className="mt-1 text-sm text-muted-foreground">{footnote}</p>
      )}
      {notice && <div className="mt-4">{notice}</div>}

      {children}
    </div>
  );
}
