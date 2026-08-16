import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Captions,
  Clapperboard,
  NotebookPen,
  Play,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * 랜딩 홈 (2026-08-15 시안 확정, docs/시안/landing.html).
 *
 * - 히어로 카피는 원장님 확정안: 비교 대상(모델 섭외)을 아는 현업의 언어를 그대로 쓴다
 * - 사진 자산은 커밋 가능한 것만 — 실제 모델 사진은 레포에 넣지 않는 조건이라
 *   비실존 AI 가상 인물(#102 sample-avatar)과 화면 요소 목업으로 대신한다
 * - 색은 전부 토큰이라 화면 색 6종을 그대로 따라간다
 */

// break-keep: 한국어 제목이 어절 중간("모/델이")에서 갈라지지 않게
const SERIF = "font-serif tracking-tight break-keep";

const TRUST_ITEMS = [
  ["얼굴만 교체", "머리는 그대로"],
  ["3규격 자동 출력", "피드 4:5 · 정방형 · 스토리 9:16"],
  ["원본 미보관", "처리 즉시 삭제"],
] as const;

const SHORTS_CLIPS = [
  { role: "시술 과정", caption: "섬세하게 완성해 가는 시술 과정", sec: "0:06" },
  { role: "디테일", caption: "작은 디테일까지 꼼꼼하게", sec: "0:05" },
  { role: "마무리", caption: "완성된 스타일을 확인해 보세요", sec: "0:04" },
] as const;

function ChapterHeading({ num, icon: Icon, children }: {
  num: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs font-medium tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {num}
      </p>
      <h2 className={`${SERIF} mt-2 text-2xl font-semibold text-balance lg:text-3xl`}>{children}</h2>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-5 space-y-2.5">
      {items.map((item, index) => (
        <li key={item} className="flex items-baseline gap-2.5 text-sm text-muted-foreground">
          <span className="flex h-5 w-5 shrink-0 translate-y-0.5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
            {index + 1}
          </span>
          {item}
        </li>
      ))}
    </ol>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-20">
      {/* 히어로 */}
      <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:py-20">
        <div>
          <p className="text-sm font-medium text-primary">💇 미용실을 위한 AI 마케팅 도구</p>
          <h1 className={`${SERIF} mt-3 text-3xl leading-snug font-semibold text-balance md:text-4xl lg:text-[2.6rem]`}>
            모델 작업에 지친 당신,
            <br />
            <span className="text-primary">오늘 시술한 그 머리가 모델이 된다면?</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
            섭외도 촬영 약속도 없이 — 손님 얼굴은 AI 가상 얼굴로 바뀌고,
            시술한 머리 모양·색은 그대로 SNS 3규격 홍보 이미지가 됩니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/face-swap" className={buttonVariants({ size: "lg" })}>무료로 시작하기</Link>
            <Link href="/face-swap" className={buttonVariants({ size: "lg", variant: "outline" })}>
              📷 예시 사진으로 체험
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border shadow-xl">
            <Image
              src="/sample-assets/sample-avatar-haired.jpg"
              alt="AI 가상 인물로 만든 홍보 이미지 예시"
              fill
              priority
              sizes="(min-width: 1024px) 24rem, 90vw"
              className="object-cover"
            />
            <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium tracking-wider text-white">
              AI 생성
            </span>
          </div>
          <div className="absolute -left-2 bottom-6 rounded-xl border bg-card/95 px-3.5 py-2.5 text-xs leading-5 text-card-foreground shadow-lg backdrop-blur">
            원본 사진은 저장하지 않습니다
            <br />
            <b className="text-primary">홍보 이미지만 남습니다</b>
          </div>
        </div>
      </section>

      {/* 신뢰 줄 */}
      <section className="flex flex-wrap gap-x-6 gap-y-2 border-y py-4">
        {TRUST_ITEMS.map(([head, tail]) => (
          <p key={head} className="text-xs text-muted-foreground">
            <b className="font-semibold text-foreground">{head}</b> · {tail}
          </p>
        ))}
      </section>

      {/* 01 얼굴 교체 */}
      <section className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div>
          <ChapterHeading num="01 · 얼굴 교체" icon={Scissors}>
            모델 섭외 없이,
            <br />
            시술 사진이 홍보 이미지로
          </ChapterHeading>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            손님을 알아볼 수 없게 얼굴만 AI 가상 얼굴로 바꿉니다. 성별·연령대·국적으로
            골라 쓰는 참조 얼굴 32종. 결과는 슬라이더로 원본과 겹쳐 보며 머리가
            그대로인지 눈으로 확인합니다.
          </p>
          <Steps items={[
            "시술 사진 올리기 (세로 사진 권장)",
            "바꿀 얼굴 고르기 — 분위기 7축 옵션",
            "확인 후 SNS 3규격으로 저장",
          ]} />
          <Link href="/face-swap" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            얼굴 교체 해보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 확인 슬라이더 은유 — 사진 위 손잡이. 실제 모델 사진 대신 AI 가상 인물을 쓴다 */}
        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border shadow-lg">
          <Image
            src="/sample-assets/sample-avatar-haired.jpg"
            alt="원본과 결과를 슬라이더로 겹쳐 확인하는 화면 예시"
            fill
            sizes="(min-width: 1024px) 24rem, 90vw"
            className="object-cover"
          />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,.2)]" />
          <span className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm text-black shadow-md">
            ↔
          </span>
          <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white">원본</span>
          <span className="absolute right-3 bottom-3 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white">교체 후 · AI 생성</span>
        </div>
      </section>

      {/* 02 블로그 — 그림을 먼저 (교차 배치) */}
      <section className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
        {/* 폰에서도 카드(그림)가 먼저 — 8/15 교차 배치 확정. DOM 순서 그대로 두면 폰·PC 둘 다 맞는다 */}
        <Card>
          <CardContent className="pt-6">
            <h3 className={`${SERIF} text-lg font-semibold`}>손상모도 부드럽게, 다크 브라운 롱 웨이브</h3>
            <p className="mt-3 text-[11px] font-bold tracking-widest text-primary">도입</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              탈색 이력이 있는 손상모라 걱정하셨던 손님. 전처리부터 차근차근 진행했습니다…
            </p>
            <p className="mt-3 text-[11px] font-bold tracking-widest text-primary">시술 과정</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              1차 클리닉 후 저온 디지털펌으로 컬을 잡고, 다크 브라운 컬러를 올렸습니다…
            </p>
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
              도입 → 시술 과정 → 관리 팁 → 마무리, 네 섹션이 한 번에 나옵니다
            </p>
          </CardContent>
        </Card>
        <div>
          <ChapterHeading num="02 · 블로그 글쓰기" icon={NotebookPen}>
            시술 기록 12칸 채우면,
            <br />
            블로그 글이 완성됩니다
          </ChapterHeading>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            시술명·모발 상태·사용 제품 같은 열두 칸만 채우면 도입부터 마무리까지
            네 섹션짜리 글이 나옵니다. 원장님 말투를 잃지 않도록, 생성 후 바로
            고쳐 쓸 수 있습니다.
          </p>
          <Steps items={[
            "시술 정보 12칸 입력",
            "4섹션 초안 생성",
            "다듬어서 복사 → 블로그에 붙여넣기",
          ]} />
          <Link href="/generate/blog" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            블로그 글 써보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 03 숏츠 */}
      <section className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div>
          <ChapterHeading num="03 · 영상 편집" icon={Clapperboard}>
            시술 영상 클립을 이어,
            <br />
            숏츠 한 편으로
          </ChapterHeading>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            시술 전·과정·디테일·완성 클립을 올리면 역할에 맞는 자막과 함께 9:16
            숏츠로 이어 붙습니다. 영상 속 얼굴은 자동으로 흐림 처리되어 손님 걱정
            없이 올릴 수 있습니다.
          </p>
          <Steps items={[
            "클립 2~8개 올리기 — 전·과정·디테일·완성",
            "구간·자막 고르기 (역할별 기본 자막 제공)",
            "9:16 숏츠로 내보내기",
          ]} />
          <Link href="/generate/shorts" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            숏츠 만들어보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex items-start gap-4">
          <div className="relative aspect-[9/16] w-2/5 shrink-0 overflow-hidden rounded-2xl border bg-gradient-to-b from-muted to-muted-foreground/25 shadow-lg">
            <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-background/90 shadow">
              <Play className="ml-0.5 h-5 w-5" />
            </span>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white">9:16 · 무음</span>
          </div>
          <ul className="flex-1 space-y-2.5">
            {SHORTS_CLIPS.map((clip) => (
              <li key={clip.role} className="rounded-xl border bg-card px-3 py-2.5 text-xs text-card-foreground shadow-sm">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Captions className="h-3.5 w-3.5 text-primary" />
                  {clip.role}
                  <span className="ml-auto font-normal text-muted-foreground">{clip.sec}</span>
                </p>
                <p className="mt-1 truncate text-muted-foreground">“{clip.caption}”</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 마무리 */}
      <section className="rounded-3xl border bg-card/60 px-6 py-12 text-center">
        <h2 className={`${SERIF} text-2xl font-semibold text-balance`}>오늘 시술한 그 머리, 오늘 올리세요</h2>
        <p className="mt-2 text-sm text-muted-foreground">사진 한 장이면 됩니다. 원본은 저장하지 않습니다.</p>
        <Link href="/face-swap" className={buttonVariants({ size: "lg", className: "mt-5" })}>
          무료로 시작하기
        </Link>
      </section>

      <p className="mt-10 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        화면의 인물은 실존하지 않는 AI 생성 가상 인물입니다.
      </p>
    </div>
  );
}
