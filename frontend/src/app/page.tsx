import Link from "next/link";
import { ArrowRight, Scissors, Palette, PenLine, Tag, FlaskConical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    href: "/face-swap",
    icon: Scissors,
    title: "얼굴 교체 홍보 이미지",
    desc: "고객 얼굴만 가상 인물로 바꿔, 초상권 걱정 없이 바로 올릴 수 있는 홍보 이미지를 만듭니다.",
    badge: "필수 · 메인",
  },
  {
    href: "/season-banner",
    icon: Tag,
    title: "시즌 배너 · 메뉴판",
    desc: "사진 없이 시즌·퍼스널컬러만 골라도, 실제 LLM이 배너 문구를 바로 만들어드립니다.",
    badge: "필수 · LLM",
  },
  {
    href: "/style-consult",
    icon: Palette,
    title: "퍼스널 스타일 상담",
    desc: "고객 얼굴은 그대로, 원하는 헤어스타일만 미리 씌워보는 시술 전 상담용 시안을 만듭니다.",
    badge: "심화",
  },
  {
    href: "/sketch-consult",
    icon: PenLine,
    title: "스케치 상담",
    desc: "상담 중 그린 스케치를 실사 헤어 이미지로 바꿉니다. (여유 시 도전 기능)",
    badge: "스트레치",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <p className="text-sm font-medium text-primary">💇 미용실 AI 마케팅 서비스</p>
      <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-balance">
        사진 찍을 시간은 있어도
        <br />
        보정할 시간은 없는 사장님을 위해
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        시술 사진 한 장으로 홍보 이미지와 문구를 바로 만들어드립니다.
      </p>

      <h2 className="mt-12 mb-4 text-sm font-medium text-muted-foreground">무엇을 도와드릴까요?</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="group">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <f.icon className="h-4.5 w-4.5" />
                  </div>
                  <Badge variant="secondary" className="text-[11px]">{f.badge}</Badge>
                </div>
                <CardTitle className="pt-2">{f.title}</CardTitle>
                <CardDescription>{f.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center gap-1 text-sm text-primary">
                  시작하기
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="mt-12 mb-4 text-sm font-medium text-muted-foreground">팀 확인용</h2>
      <Link href="/compare" className="group block">
        <Card className="transition-colors hover:border-primary/40 hover:bg-accent/40">
          <CardHeader className="flex-row items-center gap-4 space-y-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <FlaskConical className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle>🔬 모델 비교</CardTitle>
              <CardDescription>고객이 보는 화면이 아니라, 회의에서 모델·설정 비교 결과를 같이 보는 도구입니다.</CardDescription>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </CardHeader>
        </Card>
      </Link>

      <p className="mt-12 text-xs text-muted-foreground">
        실제 모델 연동 전 UI 흐름 확인용 프로토타입 · R5 혜리 작업 중 · 최종 업데이트 2026-08-04
      </p>
    </div>
  );
}
