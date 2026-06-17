"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export interface PageHeaderProps {
  title: string;
  /** 미지정 시 router.back() 기본 동작 */
  onBack?: () => void;
}

/** 뒤로가기(←) + 가운데 타이틀. study/quiz 헤더와 일치. */
export function PageHeader({ title, onBack }: PageHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <header className="flex items-center">
      <button
        type="button"
        onClick={handleBack}
        aria-label="뒤로 가기"
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-[#f5f4fb]"
      >
        <ArrowLeft size={24} strokeWidth={1.5} />
      </button>
      <h1 className="flex-1 text-center text-lg font-bold text-slate-900">
        {title}
      </h1>
      {/* 시각적 균형용 빈 공간 — 타이틀 가운데 정렬 */}
      <span className="h-11 w-11" aria-hidden="true" />
    </header>
  );
}
