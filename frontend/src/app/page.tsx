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
import { BeforeAfterSlider } from "@/components/before-after";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * 랜딩 홈 (2026-08-15 시안 확정, docs/시안/landing.html).
 *
 * - 히어로 카피는 원장님 확정안: 비교 대상(모델 작업)을 아는 현업의 언어를 그대로 쓴다
 * - 사진 짝(8/17 교체): 원본 자리는 제미나이로 만든 합성 인물(landing-hero-before,
 *   실존 인물 아님), 결과는 그 사진을 실서버 얼굴 교체(ref-01, seed 1157062057)로
 *   돌린 산출물(landing-hero-swap)이다. 실제 시술 원본은 모델 동의 범위 때문에
 *   레포에 넣을 수 없다 — salon-testset/사용조건.txt
 * - 짝의 싱크: 서버가 4:5로 자를 때 얼굴 기준으로 재프레이밍하므로, 원본을 그대로
 *   보내면 결과와 배율이 어긋난다. 그래서 미리 4:5 중앙 크롭으로 잘라 보냈다 —
 *   입력이 이미 4:5면 재프레이밍이 사실상 없어 화면의 두 장이 픽셀 단위로 겹친다
 * - 색은 전부 토큰이라 화면 색 6종을 그대로 따라간다
 */

// 글꼴은 앱 전체와 같은 프리텐다드 — 제목이라고 서체를 갈지 않는다 (8/16 원장님 확정).
// break-keep: 한국어 제목이 어절 중간("모/델이")에서 갈라지지 않게
const HEADING = "tracking-tight break-keep";

const TRUST_ITEMS = [
  ["AI 모델로 교체", "머리는 그대로"],
  // 규격 이름은 얼굴 교체 화면의 RATIO 표기와 같은 어휘를 쓴다 (8/17 확정)
  ["SNS 3규격", "피드 · 피드 세로 · 스토리 한 번에"],
  ["폰에서 바로", "촬영 · 외주 없이"],
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
      <h2 className={`${HEADING} mt-2 text-2xl font-semibold text-balance lg:text-3xl`}>{children}</h2>
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
          <h1 className={`${HEADING} text-3xl leading-snug font-semibold text-balance md:text-4xl lg:text-[2.6rem]`}>
            마케팅에 지친 우리,
            <br />
            <span className="text-primary">오늘 시술한 내 작품이 모델이 된다면?</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
            시술 사진 한 장이면, 오늘 바로 올릴 피드 이미지가 나옵니다.
          </p>
          {/* "무료"는 쓰지 않는다(8/17 원장님) — 체험 계열 동사로 통일 */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/face-swap" className={buttonVariants({ size: "lg" })}>바로 체험하기</Link>
            {/* ?sample=1 — 얼굴 교체 화면이 예시 사진을 실은 채 열린다. 빈 화면에 떨어뜨리지 않는다 */}
            <Link href="/face-swap?sample=1" className={buttonVariants({ size: "lg", variant: "outline" })}>
              📷 예시 사진으로 체험하기
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm shadow-xl">
          {/* 01번 섹션과 같은 컴포넌트 — 정적 사진 대신 자동으로 좌우 스윕해서, 스크롤
              안 하는 방문자도 "얼굴만 바뀌고 머리는 그대로"를 바로 본다. 아래 01에서
              드래그로 다시 보여주니 여기선 중복 정적 이미지를 없앴다. */}
          <BeforeAfterSlider
            beforeUrl="/sample-assets/landing-hero-before.jpg"
            afterUrl="/sample-assets/landing-hero-swap.jpg"
            beforeLabel="원본"
            afterLabel="교체 후"
            autoPlay
          />
          <div className="absolute -left-2 bottom-6 rounded-xl border bg-card/95 px-3.5 py-2.5 text-xs leading-5 text-card-foreground shadow-lg backdrop-blur">
            시술한 머리 그대로,
            <br />
            <b className="text-primary">자연스러운 홍보 이미지</b>
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
          <ChapterHeading num="01 · 헤어 모델 만들기" icon={Scissors}>
            모델 섭외 없이,
            <br />
            시술 사진이 홍보 이미지로
          </ChapterHeading>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            얼굴은 AI 모델로 교체, 공들인 머리 모양·색은 그대로 정확하게.
            32가지 AI 모델 중 골라 몇 초 만에 자연스럽게 완성됩니다.
          </p>
          <Steps items={[
            "시술 사진 올리기",
            "AI 모델 고르기",
            "SNS 3규격으로 저장",
          ]} />
          <Link href="/face-swap" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            헤어 모델 체험하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 진짜로 움직이는 확인 슬라이더 — 얼굴 교체 화면과 같은 컴포넌트, 위 사진 짝 사용 */}
        <div className="mx-auto w-full max-w-sm shadow-lg">
          <BeforeAfterSlider
            beforeUrl="/sample-assets/landing-hero-before.jpg"
            afterUrl="/sample-assets/landing-hero-swap.jpg"
            beforeLabel="원본"
            afterLabel="교체 후"
          />
        </div>
      </section>

      {/* 02 블로그 — 그림을 먼저 (교차 배치) */}
      <section className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
        {/* 폰에서도 카드(그림)가 먼저 — 8/15 교차 배치 확정. DOM 순서 그대로 두면 폰·PC 둘 다 맞는다 */}
        <Card>
          <CardContent className="pt-6">
            <h3 className={`${HEADING} text-lg font-semibold`}>손상모도 부드럽게, 다크 브라운 롱 웨이브</h3>
            <p className="mt-3 text-[11px] font-bold tracking-widest text-primary">도입</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              탈색 이력이 있는 손상모라 걱정하셨던 손님. 전처리부터 차근차근 진행했습니다…
            </p>
            <p className="mt-3 text-[11px] font-bold tracking-widest text-primary">시술 과정</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              1차 클리닉 후 저온 디지털펌으로 컬을 잡고, 다크 브라운 컬러를 올렸습니다…
            </p>
          </CardContent>
        </Card>
        <div>
          <ChapterHeading num="02 · 간단 블로그 글쓰기" icon={NotebookPen}>
            시술 기록만 남기면,
            <br />
            블로그 글이 완성됩니다
          </ChapterHeading>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            빈칸만 채우면 도입부터 마무리까지 완성된 글이 빠르게 나옵니다.
            내 말투로 고쳐 쓰는 것도 간편하게.
          </p>
          <Steps items={[
            "시술 정보 입력",
            "글 완성",
            "복사해서 블로그에 붙여넣기",
          ]} />
          <Link href="/generate/blog" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            블로그 글 체험하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 03 숏츠 */}
      <section className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div>
          <ChapterHeading num="03 · 간편 숏츠 만들기" icon={Clapperboard}>
            시술 영상 클립을 이어,
            <br />
            숏츠 한 편으로
          </ChapterHeading>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            찍어둔 클립만 고르면 자막까지 얹은 숏츠가 나옵니다.
            편집 프로그램 없이, 폰으로 찍은 영상 그대로.
          </p>
          <Steps items={[
            "시술 영상 올리기",
            "장면·자막 고르기",
            "숏츠로 내보내기",
          ]} />
          <Link href="/generate/shorts" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            숏츠 체험하기
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
        <h2 className={`${HEADING} text-2xl font-semibold text-balance`}>오늘 시술한 그 머리, 오늘 올리세요</h2>
        <p className="mt-2 text-sm text-muted-foreground">사진 한 장이면 됩니다.</p>
        <Link href="/face-swap" className={buttonVariants({ size: "lg", className: "mt-5" })}>
          바로 체험하기
        </Link>
      </section>

      <p className="mt-10 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        화면의 인물은 실존하지 않는 AI 생성 가상 인물입니다.
      </p>
    </div>
  );
}
