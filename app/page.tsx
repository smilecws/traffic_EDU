"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ExternalLink,
  FileText,
  GraduationCap,
  ListOrdered,
  MoreVertical,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { MenuCard } from "@/components/shared/MenuCard";
import { ExternalLinkRow } from "@/components/shared/ExternalLinkRow";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { OptionRow } from "@/components/shared/OptionRow";
import { useConsent } from "@/lib/hooks/useConsent";

const iconProps = { size: 24, strokeWidth: 1.5 } as const;

export default function Home() {
  const router = useRouter();
  const { withdraw } = useConsent();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleWithdraw = async () => {
    const confirmed = window.confirm(
      "개인정보 제공·이용 동의를 철회할까요?\n수집된 이름이 삭제되고, 계속 이용하려면 다시 동의해야 합니다.",
    );
    if (!confirmed) return;
    // step 0: 서버 이름 삭제 + 로컬 동의 삭제. 이후 하드 리로드로 동의 게이트 재표시.
    await withdraw();
    window.location.assign("/");
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-6">
      {/* 헤더 블록 */}
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-violet-500">초심찾기</p>
          <h1 className="text-2xl font-bold text-slate-900">도로교통법</h1>
        </div>
        <button
          type="button"
          aria-label="더보기"
          onClick={() => setMenuOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ebe9f5] bg-white text-slate-400"
        >
          <MoreVertical size={20} strokeWidth={1.5} />
        </button>
      </header>

      {/* 기능 카드 2×2 그리드 */}
      <section className="grid grid-cols-2 gap-3">
        <MenuCard
          icon={<BookOpen {...iconProps} />}
          color="green"
          title="학습하기"
          subtitle="개념과 자료로 차분히"
          onClick={() => router.push("/study")}
        />
        <MenuCard
          icon={<FileText {...iconProps} />}
          color="violet"
          title="문제 풀기"
          subtitle="모의고사 · 연습 · 오답"
          onClick={() => router.push("/quiz")}
        />
        <MenuCard
          icon={<ListOrdered {...iconProps} />}
          color="indigo"
          title="면허시험 순서"
          subtitle="응시 절차를 한 번에 정리"
          onClick={() => router.push("/guide/exam-order")}
        />
        <MenuCard
          icon={<CheckSquare {...iconProps} />}
          color="teal"
          title="준비물 가이드"
          subtitle="시험 당일 챙길 준비물"
          onClick={() => router.push("/guide/prep")}
        />
      </section>

      {/* 외부 페이지 섹션 */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <ExternalLink size={14} strokeWidth={1.5} />
          <span>한국도로교통공단 · 외부 페이지</span>
        </div>
        <div className="space-y-2">
          <ExternalLinkRow
            icon={<GraduationCap {...iconProps} />}
            color="rose"
            title="특별교통안전교육 일정"
            subtitle="지역별 교육 일정 확인"
            href="https://www.safedriving.or.kr/main.do"
          />
          <ExternalLinkRow
            icon={<CalendarDays {...iconProps} />}
            color="indigo"
            title="운전면허시험 일정"
            subtitle="전국 시험장 일정 조회"
            href="https://www.safedriving.or.kr/main.do"
          />
        </div>
      </section>

      {/* ⋮ 설정 메뉴 */}
      <BottomSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="설정"
      >
        <div className="space-y-2.5">
          <OptionRow
            icon={<ShieldCheck {...iconProps} />}
            color="indigo"
            title="개인정보처리방침"
            subtitle="수집 항목과 처리 방침 보기"
            onClick={() => router.push("/privacy")}
          />
          <button
            type="button"
            onClick={handleWithdraw}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#ebe9f5] bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <UserX {...iconProps} />
            </span>
            <div className="flex-1">
              <p className="text-base font-semibold text-red-600">
                개인정보 제공·이용 철회
              </p>
              <p className="text-sm text-slate-500">
                수집된 이름 삭제 · 재동의 필요
              </p>
            </div>
          </button>
        </div>
      </BottomSheet>
    </main>
  );
}
