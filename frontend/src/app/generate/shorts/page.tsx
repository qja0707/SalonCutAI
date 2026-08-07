import {
  Captions,
  Check,
  Clapperboard,
  ImageIcon,
  Info,
  Play,
  Scissors,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DIRECTIONS = [
  {
    title: "사진 기반 AI 숏츠",
    description: "시술 전후 사진에 자연스러운 움직임을 더해 짧은 홍보 영상을 만듭니다.",
    icon: ImageIcon,
    points: ["결과 사진 중심", "AI 모션 생성", "홍보 문구·음악 조합"],
  },
  {
    title: "시술 영상 자동 편집",
    description: "직접 촬영한 시술 영상에서 핵심 장면을 골라 세로형 영상으로 편집합니다.",
    icon: Video,
    points: ["원본 영상 중심", "하이라이트 자동 추출", "자막·색감·전환 보정"],
  },
] as const;

const STEPS = [
  { label: "사진·영상 업로드", icon: Upload },
  { label: "AI 장면 구성", icon: Sparkles },
  { label: "자막·브랜드 적용", icon: Captions },
  { label: "9:16 영상 완성", icon: Clapperboard },
] as const;

export default function GenerateShortsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">
            기능 방향 논의 중
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            AI 숏츠 만들기
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            미용실의 시술 결과물을 세로형 홍보 영상으로 만드는 도구입니다. 실제 제작 방식은
            UI 담당자와 논의한 뒤 확정합니다.
          </p>
        </div>
        <Button disabled className="sm:mt-1">
          <Play data-icon="inline-start" />
          방향 확정 후 제작 시작
        </Button>
      </div>

      <Alert className="mb-6 border-primary/20 bg-primary/5 px-4 py-3">
        <Info className="text-primary" />
        <AlertTitle>현재는 화면 구조만 확인하는 단계입니다</AlertTitle>
        <AlertDescription>
          AI 모델 호출과 영상 업로드는 연결하지 않았습니다. 사진 생성형과 영상 편집형 중 MVP
          방향을 정한 뒤 구현 범위를 고정합니다.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-6">
          <div>
            <h2 className="mb-3 text-base font-semibold">제작 방식 후보</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {DIRECTIONS.map((direction) => {
                const Icon = direction.icon;
                return (
                  <Card key={direction.title} className="transition-colors hover:ring-primary/30">
                    <CardHeader>
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle>{direction.title}</CardTitle>
                      <CardDescription className="leading-6">
                        {direction.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {direction.points.map((point) => (
                          <li key={point} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>예상 제작 흐름</CardTitle>
              <CardDescription>방식이 확정되어도 사용 흐름은 단순하게 유지합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.label} className="rounded-xl bg-muted/70 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {index + 1}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{step.label}</p>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </section>

        <aside>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>9:16 미리보기</CardTitle>
              <CardDescription>숏츠 결과 화면 예시</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mx-auto aspect-[9/16] w-full max-w-[230px] overflow-hidden rounded-3xl bg-[linear-gradient(160deg,#1b64da_0%,#3182f6_45%,#91c4ff_100%)] p-5 text-white shadow-xl">
                <div className="flex items-center justify-between text-[10px] font-medium text-white/80">
                  <span>SALON CUT AI</span>
                  <span>00:15</span>
                </div>
                <div className="absolute inset-x-5 top-1/3 rounded-2xl border border-white/25 bg-white/10 px-4 py-6 text-center backdrop-blur-sm">
                  <Scissors className="mx-auto mb-3 h-7 w-7" />
                  <p className="text-sm font-semibold">오늘의 스타일 변신</p>
                  <p className="mt-1 text-[10px] text-white/75">AI 숏츠 미리보기</p>
                </div>
                <div className="absolute inset-x-5 bottom-5 rounded-xl bg-black/25 p-3 backdrop-blur-sm">
                  <p className="text-xs font-semibold">나에게 어울리는 스타일을 만나보세요</p>
                  <p className="mt-1 text-[10px] text-white/70">#헤어스타일 #미용실추천</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
