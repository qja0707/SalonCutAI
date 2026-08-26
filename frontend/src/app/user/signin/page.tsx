"use client";

import { useState } from "react";
import { Lock, Mail, LogIn, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signin } from "@/lib/api-client/client";
import { useRouter } from "next/navigation";
import { setCookie } from "@/lib/cookies";
import { ACCESS_TOKEN_EXPIRE_MS, REFRESH_TOKEN_EXPIRE_MS } from "@/constants";

/**
 * 로그인 뒤 돌아갈 곳. 기능 화면에서 로그인 안내를 받고 넘어온 경우
 * (`/user/signin?redirect=/generate/shorts`) 하던 일을 이어갈 수 있어야 한다.
 *
 * 외부 주소로 튕기는 것(open redirect)을 막으려고 **내부 절대 경로만** 허용한다 —
 * `//evil.com` 은 브라우저가 프로토콜 상대 URL 로 읽으므로 함께 막는다.
 */
function safeRedirectTarget(): string {
  if (typeof window === "undefined") return "/";
  const target = new URLSearchParams(window.location.search).get("redirect");
  if (!target || !target.startsWith("/") || target.startsWith("//")) return "/";
  return target;
}

export default function LoginPage() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSigninError, setIsSigninError] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await signin({ id, pw: password });

      setCookie("accessToken", response.access_token, ACCESS_TOKEN_EXPIRE_MS);
      setCookie(
        "refreshToken",
        response.refresh_token,
        REFRESH_TOKEN_EXPIRE_MS,
      );

      router.push(safeRedirectTarget());
    } catch (error) {
      console.log("login error:", String(error));
      setIsSigninError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-10">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-1.5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LogIn className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">
            로그인
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            서비스 이용을 위해 아이디와 비밀번호를 입력해주세요.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 아이디 입력란 */}
            <div className="space-y-1.5">
              <label
                htmlFor="id"
                className="text-xs font-medium text-foreground"
              >
                아이디
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="id"
                  type="id"
                  required
                  placeholder="test1234"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            {/* 비밀번호 입력란 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-medium text-foreground"
                >
                  비밀번호
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            {isSigninError && (
              <div className="rounded-md bg-destructive/10 p-2.5 text-center text-xs font-medium text-destructive">
                아이디 혹은 비밀번호가 일치하지 않습니다
              </div>
            )}

            {/* 로그인 제출 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                buttonVariants({ size: "default" }),
                "mt-2 w-full gap-2 font-medium",
              )}
            >
              {isLoading ? (
                "로그인 중..."
              ) : (
                <>
                  로그인하기 <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
