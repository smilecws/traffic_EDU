"use client";

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
} from "lucide-react";
import { MenuCard } from "@/components/shared/MenuCard";
import { ExternalLinkRow } from "@/components/shared/ExternalLinkRow";

const iconProps = { size: 24, strokeWidth: 1.5 } as const;

export default function Home() {
  const router = useRouter();

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
    </main>
  );
}
