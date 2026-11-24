"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBackGuard } from "@/lib/hooks/useBackGuard";
import { hasInAppHistory } from "@/lib/utils/appHistory";

export interface PageHeaderProps {
  title: string;
  /** 미지정 시 기본 동작(앱 안에서 왔으면 뒤로가기, 아니면 parentHref) */
  onBack?: () => void;
  /**
   * 바로 진입해서 앱 안에 돌아갈 기록이 없을 때 ←가 향할 상위 화면. 기본 "/".
   * 하위 화면(예: /quiz/history)은 자기 상위 경로를 직접 지정한다.
   */
  parentHref?: string;
}

/**
 * 뒤로가기(←) + 가운데 타이틀. study/quiz 헤더와 일치.
 *
 * onBack 없이 쓰면 "한 단계 위로" — 앱 안에서 넘어온 기록이 있으면 router.back()으로
 * 왔던 화면에 돌려보내고, 링크·QR·주소 입력으로 이 화면에 바로 들어온 경우에는
 * 기록에 기대지 않고 parentHref로 보낸다(기록을 쌓지 않도록 replace).
 * 그냥 router.back()만 쓰면 후자에서 사이트 밖으로 나가 버린다 — lib/utils/appHistory.ts 참고.
 *
 * onBack을 넘겨 동작을 바꾼 화면은 useBackGuard가 브라우저 뒤로가기도
 * 같은 동작으로 맞춰 준다(둘의 반응이 갈리지 않게).
 */
export function PageHeader({ title, onBack, parentHref = "/" }: PageHeaderProps) {
  const router = useRouter();
  const { requestLeave } = useBackGuard({
    enabled: onBack != null,
    onLeave: () => onBack?.(),
  });
  const handleBack = onBack
    ? requestLeave
    : () => {
        if (hasInAppHistory()) router.back();
        else router.replace(parentHref);
      };

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
