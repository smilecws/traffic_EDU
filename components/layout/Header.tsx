import Link from "next/link";
import { Navigation } from "./Navigation";

/** 앱 제목 + 주요 내비게이션. */
export function Header() {
  return (
    <header className="border-b border-[#ebe9f5] bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 md:px-6">
        <Link
          href="/"
          className="text-base font-semibold text-slate-900 transition-colors hover:text-violet-600"
        >
          초심찾기 도로교통법
        </Link>
        <Navigation />
      </div>
    </header>
  );
}
