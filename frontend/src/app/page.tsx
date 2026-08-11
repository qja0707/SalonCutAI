import Link from "next/link";
import { ArrowRight, Scissors, NotebookPen, Clapperboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// MVP 3기능(Discussion #23)만 노출한다. 제목은 사이드바 라벨과 같은 문구를 쓴다.
const FEATURES = [
  {
    href: "/face-swap",
    icon: Scissors,
    title: "AI 모델로 얼굴 변경",
    desc: "고객 얼굴을 AI가 만든 가상 얼굴로 바꿔 홍보용 이미지를 만듭니다.",
  },
  {
    href: "/generate/blog",
    icon: NotebookPen,
    title: "AI 블로그 글쓰기",
    desc: "시술 정보를 입력하면 네이버 블로그에 바로 붙여넣을 수 있는 후기 글을 만듭니다.",
  },
  {
    href: "/generate/shorts",
    icon: Clapperboard,
    title: "AI 숏츠 만들기",
    desc: "찍어둔 시술 영상을 올리면 홍보용 세로 영상으로 편집해 드립니다.",
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
        시술 사진과 영상으로 홍보 콘텐츠를 바로 만들어드립니다.
      </p>

      <h2 className="mt-12 mb-4 text-sm font-medium text-muted-foreground">무엇을 도와드릴까요?</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="group">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
              <CardHeader>
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <f.icon className="h-4.5 w-4.5" />
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

      <p className="mt-12 text-xs text-muted-foreground">
        실제 모델 연동 전 UI 흐름 확인용 프로토타입
      </p>
    </div>
  );
}
