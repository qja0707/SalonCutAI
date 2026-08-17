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
  icon: LucideIcon;
};

// MVP 3기능(Discussion #23)과 홈만 노출한다.
// 라벨은 랜딩 챕터·기능 화면 h1과 같은 문구를 쓴다 — 이름이 다르면 다른 기능으로 읽는다.
// 8/17 원장님 확정 네이밍: 헤어 모델 만들기 · 간단 블로그 글쓰기 · 간편 숏츠 만들기.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: Home },
  { href: "/face-swap", label: "헤어 모델 만들기", icon: Scissors },
  { href: "/generate/blog", label: "간단 블로그 글쓰기", icon: NotebookPen },
  { href: "/generate/shorts", label: "간편 숏츠 만들기", icon: Clapperboard },
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
