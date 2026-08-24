import type { LucideIcon } from "lucide-react";
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
 * 숏츠는 아직 쓰지 않는다. 배지가 제목 위에 있고 CTA 가 헤더 오른쪽에 붙는 등 모양이
 * 달라서, 화면을 재구성하는 PR 에서 함께 옮긴다.
 */

const WIDTH = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

export type PageShellWidth = keyof typeof WIDTH;

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
  /** 설명 아래 배지. 여백은 여기서 잡으므로 호출부는 `mt-*` 를 붙이지 않는다 */
  badge?: React.ReactNode;
  /** 헤더 아래 항상 보이는 안내. 공개 미리보기 고지처럼 접히면 안 되는 것 */
  notice?: React.ReactNode;
  width?: PageShellWidth;
  /** 화면별 예외 여백. 폰 하단 고정 바가 있는 화면의 `pb-*` 같은 것 */
  className?: string;
  children: React.ReactNode;
}) {
  const heading = (
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
  );

  return (
    <div className={cn("mx-auto px-6 py-10", WIDTH[width], className)}>
      {Icon ? (
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {heading}
        </div>
      ) : (
        heading
      )}

      {description && (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      )}
      {footnote && (
        <p className="mt-1 text-sm text-muted-foreground">{footnote}</p>
      )}
      {badge && <div className="mt-3">{badge}</div>}
      {notice && <div className="mt-4">{notice}</div>}

      {children}
    </div>
  );
}
