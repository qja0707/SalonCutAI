import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  NotebookPen,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { BeforeAfterSlider } from "@/components/before-after";
import { BlogExampleCard } from "@/components/blog-example-card";
import { buttonVariants } from "@/components/ui/button";
import { ShortsPreviewVideo } from "@/components/shorts-preview-video";

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

/**
 * landing-shorts-sample.mp4(8초) 안에 실제로 들어있는 자막을 그대로 옮겼다
 * (실측: 0.5/2.5/4.5/6.5초 지점 확인) — 예전 3개 항목은 이 영상과 무관한
 * 문구였다(실측 지적).
 */
const SHORTS_CLIPS = [
  { role: "시술 전", caption: "시술 전 상태를 확인합니다", sec: "0:02" },
  { role: "탈색", caption: "탈색약을 꼼꼼히 도포합니다", sec: "0:02" },
  { role: "염색", caption: "염색약을 도포합니다", sec: "0:02" },
  { role: "완성", caption: "변화된 모습을 확인합니다", sec: "0:02" },
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
      {/* 01 헤어 모델 만들기 — 히어로와 통합(실측: 정적 사진 히어로 + 아래 01 슬라이더가
          같은 사진 짝을 두 번 보여주는 중복이었다). 히어로의 카피·체험 버튼은 그대로
          맨 위로 올리고, 01의 소제목·스텝 리스트·중복 CTA는 걷어냈다. */}
      <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:py-20">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium tracking-widest text-muted-foreground">
            <Scissors className="h-3.5 w-3.5" />
            01 · 헤어 모델 만들기
          </p>
          <h1 className={`${HEADING} mt-2 text-3xl leading-snug font-semibold text-balance md:text-4xl lg:text-[2.6rem]`}>
            마케팅에 지친 우리,
            <br />
            <span className="text-primary">오늘 시술한 내 작품이 모델이 된다면?</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
            시술 사진 한 장이면, 오늘 바로 올릴 피드 이미지가 나옵니다.
          </p>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="relative shadow-xl">
            {/* 정적 사진 대신 자동으로 좌우 스윕해서, 스크롤 안 하는 방문자도 "얼굴만
                바뀌고 머리는 그대로"를 바로 본다. */}
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
          {/* "무료"는 쓰지 않는다(8/17 원장님) — 체험 계열 동사로 통일. 예시 사진
              체험 링크는 걷어냄 — 버튼 하나로 정리(실측 지적) */}
          <Link href="/face-swap" className={buttonVariants({ size: "lg", className: "mt-6 w-full" })}>
            바로 체험하기
          </Link>
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

      {/* 02 블로그 — 제목 아래 실제 골든셋 예시(실측 지적: 요약 카드로는 "블로그 글"이란
          인지가 안 됨). blog-generator.tsx 결과 패널과 같은 데이터·마크업을 그대로 쓴다. */}
      <section className="py-14 lg:py-20">
        <ChapterHeading num="02 · 간단 블로그 글쓰기" icon={NotebookPen}>
          시술 기록만 남기면,
          <br />
          블로그 글이 완성됩니다
        </ChapterHeading>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
          빈칸만 채우면 도입부터 마무리까지 완성된 글이 빠르게 나옵니다.
          내 말투로 고쳐 쓰는 것도 간편하게.
        </p>
        <Steps items={[
          "시술 정보 입력",
          "글 완성",
          "복사해서 블로그에 붙여넣기",
        ]} />

        {/* 체험 버튼은 예시를 본 다음(아래)에 둔다 — "이런 글이 나오는구나, 나도
            해볼까" 하는 순간에 바로 누르게. 01번 히어로의 버튼 위치와 같은
            원칙이다(실측 지적: 색도 히어로 버튼처럼 채워져야 함). */}
        <BlogExampleCard />
        <div className="mt-6 flex justify-center">
          <Link href="/generate/blog" className={buttonVariants({ size: "lg" })}>
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
        </div>

        {/* 영상 위 · 타임라인 아래 세로 배치 — 폭이 좁은 폰에서 영상 2/5 폭 + 자막
            목록을 좌우로 나누면 둘 다 눌려서 읽기 어려웠다(실측 지적). 체험 버튼도
            여기(예시 아래)로 옮겼다 — 02번 블로그와 같은 원칙(실측 지적). */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative aspect-[9/16] w-40 shrink-0 overflow-hidden rounded-2xl border shadow-lg">
            <ShortsPreviewVideo src="/sample-assets/landing-shorts-sample.mp4" />
            <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white">9:16 · 무음</span>
          </div>
          {/* 카드 4장을 세로로 나열하니 너무 길었다(실측 지적) — 장면 이름만
              한 줄짜리 흐름으로 압축했다. 자막 원문은 영상 안에서 직접 보인다. */}
          <ol className="flex w-full max-w-sm items-center justify-center gap-1.5 text-xs">
            {SHORTS_CLIPS.map((clip, index) => (
              <li key={clip.role} className="flex items-center gap-1.5">
                <span className="rounded-full border bg-card px-2.5 py-1 font-medium whitespace-nowrap text-card-foreground shadow-sm">
                  {clip.role}
                </span>
                {index < SHORTS_CLIPS.length - 1 && (
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
              </li>
            ))}
          </ol>
          <Link href="/generate/shorts" className={buttonVariants({ size: "lg" })}>
            숏츠 체험하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 마무리 */}
      <section className="rounded-3xl border bg-card/60 px-6 py-12 text-center">
        <h2 className={`${HEADING} text-2xl font-semibold text-balance`}>
          휴대폰 속에 잠든 시술 사진,
          <br />
          오늘 올려보세요!
        </h2>
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
