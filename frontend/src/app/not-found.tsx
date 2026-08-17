import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/nav";

/**
 * 404 화면. 이 파일이 없으면 Next 기본 영문 화면이 나온다 (상태 감사 G1).
 * 잘못 들어온 사람이 다음에 갈 곳은 결국 MVP 3기능이라, 메뉴와 같은 목록을 바로 준다.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-4xl">💇</p>
      <h1 className="text-xl font-semibold tracking-tight">이 주소에는 페이지가 없어요</h1>
      <p className="text-sm text-muted-foreground">
        주소가 바뀌었거나 잘못 입력된 것 같아요. 찾으시는 건 아마 이 중 하나일 거예요.
      </p>
      <nav className="mt-2 flex flex-col gap-2">
        {NAV_ITEMS.filter((item) => item.href !== "/").map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <item.icon className="h-4 w-4 text-primary" />
            {item.label}
          </Link>
        ))}
      </nav>
      <Link href="/" className="mt-1">
        <Button variant="outline">
          <Home className="h-4 w-4" />
          홈으로
        </Button>
      </Link>
    </div>
  );
}
