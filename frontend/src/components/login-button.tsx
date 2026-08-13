"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { deleteCookie, getCookie } from "@/lib/cookies";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";

type Props = {
  mode: "desktop" | "mobile";
};

function LoginButtonInner({ mode }: Props) {
  const router = useRouter();

  // ssr: false로 렌더링되므로 브라우저 환경이 보장되어 바로 쿠키를 읽어도 에러가 안 납니다.
  const isLogIn = Boolean(getCookie("accessToken"));

  const handlePressButton = () => {
    if (isLogIn) {
      deleteCookie("accessToken");
      deleteCookie("refreshToken");
      router.push("/");
      return;
    }
    router.push("/user/signin");
  };

  const text = isLogIn ? "로그아웃" : "로그인";
  const Icon = isLogIn ? LogOut : LogIn;

  return (
    <button
      type="button"
      onClick={handlePressButton}
      className={cn(
        buttonVariants({
          variant: mode === "mobile" ? "ghost" : "outline",
          size: "sm",
        }),
        mode === "mobile"
          ? "h-8 gap-1 px-2.5 text-xs text-primary"
          : "w-full justify-start gap-2 text-xs font-medium",
      )}
    >
      <Icon className="h-3.5 w-3.5 text-primary" />
      {text}
    </button>
  );
}

export default dynamic(() => Promise.resolve(LoginButtonInner), {
  ssr: false,
  loading: () => (
    <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
  ),
});
