import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // 높이는 모바일 우선이다. 좁은 화면에서는 손가락으로 누르므로 48px(h-12)을 확보하고,
      // sm(640px) 이상에서 기존 데스크톱 높이로 돌아간다.
      // 매장에서 폰으로 쓰는 것이 기본 사용 흐름이라 이쪽을 기준값으로 둔다.
      //
      // 48px 로 잡으면 네 기준을 모두 만족한다 —
      //   WCAG 2.5.8(AA) 24px / Apple HIG 기본값 44pt / Material 48dp / WCAG 2.5.5(AAA) 44px
      // Material 3 은 칩·버튼에 밀도를 적용해 48px 아래로 내리지 말라고 명시한다.
      //
      // xs 계열만 40px(h-10) 로 둔다. 조밀한 자리에 쓰는 크기라 48px 로 올리면
      // default 와 같아져 구분이 사라진다.
      size: {
        default:
          "h-12 gap-1.5 px-2.5 sm:h-8 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-10 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs sm:h-6 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-12 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] sm:h-7 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-1.5 px-2.5 sm:h-9 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-12 sm:size-8",
        "icon-xs":
          "size-10 rounded-[min(var(--radius-md),10px)] sm:size-6 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-12 rounded-[min(var(--radius-md),12px)] sm:size-7 in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-12 sm:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
