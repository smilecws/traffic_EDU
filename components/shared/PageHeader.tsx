"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBackGuard } from "@/lib/hooks/useBackGuard";

export interface PageHeaderProps {
  title: string;
  /** 미지정 시 router.back() 기본 동작 */
  onBack?: () => void;
}

/**
 * 뒤로가기(←) + 가운데 타이틀. study/quiz 헤더와 일치.
 *
 * onBack 없이 쓰면 router.back() — 브라우저 뒤로가기와 같은 동작이다.
 * onBack을 넘겨 동작을 바꾼 화면은 useBackGuard가 브라우저 뒤로가기도
 * 같은 동작으로 맞춰 준다(둘의 반응이 갈리지 않게).
 */
export function PageHeader({ title, onBack }: PageHeaderProps) {
  const router = useRouter();
  const { requestLeave } = useBackGuard({
    enabled: onBack != null,
    onLeave: () => onBack?.(),
  });
  const handleBack = onBack ? requestLeave : () => router.back();

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
