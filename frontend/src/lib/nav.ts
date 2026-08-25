import type { LucideIcon } from "lucide-react";
import {
  Scissors,
  Palette,
  PenLine,
  Tag,
  FlaskConical,
  Home,
  CalendarDays,
  ImageIcon,
  NotebookPen,
  Camera,
  Clapperboard,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /**
   * 폰 상단 메뉴에서만 쓰는 짧은 이름. 없으면 label 을 그대로 쓴다.
   *
   * 폰에서는 메뉴가 가로 한 줄이라 네 개가 다 안 들어가 잘려 보였다(390px 실측:
   * 보이는 폭 306px, 내용 529px). label 은 8/17 원장님이 정한 이름이라 그대로 두고,
   * 좁은 화면에서만 줄인다.
   */
  shortLabel?: string;
  icon: LucideIcon;
};

// MVP 3기능(Discussion #23)과 홈만 노출한다.
// 8/17 원장님 확정 — 역할을 나눈다: 메뉴는 기존 "AI 000" 이름, 기능 화면 대제목과
// 랜딩 챕터는 새 네이밍(헤어 모델 만들기 · 간단 블로그 글쓰기 · 간편 숏츠 만들기).
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: Home },
  { href: "/face-swap", label: "AI 모델로 얼굴 변경", shortLabel: "얼굴 변경", icon: Scissors },
  { href: "/generate/blog", label: "AI 블로그 글쓰기", shortLabel: "블로그", icon: NotebookPen },
  { href: "/generate/shorts", label: "AI 숏츠 만들기", shortLabel: "숏츠", icon: Clapperboard },
];

// MVP 범위 밖이라 메뉴에서 내린 화면들이다. 라우트와 화면 코드는 그대로 살아 있어
// 주소로 직접 접근하면 동작한다. 범위가 다시 넓어지면 NAV_ITEMS 로 옮기면 된다.
// /compare 는 팀 내부 모델 비교 도구라 사용자 메뉴에 두지 않는다.
export const HIDDEN_NAV_ITEMS: NavItem[] = [
  { href: "/style-consult", label: "퍼스널 스타일 상담", icon: Palette },
  { href: "/sketch-consult", label: "스케치 상담", icon: PenLine },
  { href: "/season-banner", label: "시즌 배너·메뉴판", icon: Tag },
  { href: "/marketing-calendar", label: "마케팅 캘린더", icon: CalendarDays },
  { href: "/generate/image", label: "이미지 생성", icon: ImageIcon },
  { href: "/generate/caption", label: "인스타 캡션 생성", icon: Camera },
  { href: "/compare", label: "모델 비교", icon: FlaskConical },
];
