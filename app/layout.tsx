import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";
import AuthProvider from "@/components/AuthProvider";
import { ConsentGate } from "@/components/ConsentGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "초심찾기 도로교통법",
  description:
    "데이터 기반 도로교통법 학습 플랫폼 — 약점 영역을 분석하고 학습 효율을 높입니다. 로그인 없이 바로 시작하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <AuthProvider>
            <ConsentGate>{children}</ConsentGate>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
