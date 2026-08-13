import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const pretendard = localFont({
  src: "../fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "미용실 AI 마케팅 서비스",
  description: "시술 사진 한 장으로 홍보 이미지·문구를 만드는 미용실 AI 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 테마 클래스는 브라우저에서 붙는다. 서버가 만든 HTML 과 다를 수밖에 없으므로
    // 이 한 단계만 경고를 끈다(next-themes 권장). 아래 자식들에는 적용되지 않는다.
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
