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
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section: "customer" | "tools" | "team";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: Home, section: "customer" },
  { href: "/face-swap", label: "페이스 스왑", icon: Scissors, section: "customer" },
  { href: "/style-consult", label: "퍼스널 스타일 상담", icon: Palette, section: "customer" },
  { href: "/sketch-consult", label: "스케치 상담", icon: PenLine, section: "customer" },
  { href: "/season-banner", label: "시즌 배너·메뉴판", icon: Tag, section: "customer" },
  { href: "/marketing-calendar", label: "마케팅 캘린더", icon: CalendarDays, section: "customer" },
  { href: "/generate/image", label: "이미지 생성", icon: ImageIcon, section: "tools" },
  { href: "/generate/blog", label: "블로그 글 생성", icon: NotebookPen, section: "tools" },
  { href: "/generate/caption", label: "인스타 캡션 생성", icon: Camera, section: "tools" },
  { href: "/compare", label: "모델 비교", icon: FlaskConical, section: "team" },
];
