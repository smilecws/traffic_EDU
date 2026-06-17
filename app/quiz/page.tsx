"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Flag,
  History,
  FileText,
  Image as ImageIcon,
  ListOrdered,
  Shuffle,
  Star,
  Trophy,
  TrendingUp,
  Video,
  XCircle,
} from "lucide-react";
import { useStats } from "@/lib/hooks/useStats";
import { useWrongNotes } from "@/lib/hooks/useWrongNotes";
import { LICENSE_TYPES } from "@/lib/data/licenses";
import { QUESTION_TYPES } from "@/lib/data/questionTypes";
import type { TileColor } from "@/components/shared/IconTile";
import { PageHeader } from "@/components/shared/PageHeader";
import { MenuCard } from "@/components/shared/MenuCard";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { OptionRow } from "@/components/shared/OptionRow";
import { Button } from "@/components/shared/Button";

/** 전체 문제 수 — 순서대로 풀기 입력 범위. */
const TOTAL_QUESTIONS = 1000;

const iconProps = { size: 24, strokeWidth: 1.5 } as const;

/** 유형 선택 시트의 행 스타일(색/부제/아이콘). 키는 question_types.json 값. */
const TYPE_STYLE: Record<string, { color: TileColor; subtitle: string; icon: ReactNode }> = {
  "도로교통법규 문제": {
    color: "blue",
    subtitle: "법규·표지 문장형 문제",
    icon: <FileText {...iconProps} />,
  },
  "사진 및 상황 문제": {
    color: "teal",
    subtitle: "사진·일러스트 문제",
    icon: <ImageIcon {...iconProps} />,
  },
  동영상문제: {
    color: "rose",
    subtitle: "동영상 문제",
    icon: <Video {...iconProps} />,
  },
};

/** 문제 풀기 허브 — 진도 카드 + 메뉴 그리드. useStats/useWrongNotes 읽기 전용. */
export default function QuizHubPage() {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [seqSheetOpen, setSeqSheetOpen] = useState(false);
  const [startInput, setStartInput] = useState("1");
  const { data: stats } = useStats();
  const { data: notes } = useWrongNotes();

  // 순서대로 풀기 — 입력 번호 검증 후 sequential 모드로 이동.
  const startNumber = Number(startInput);
  const startValid =
    Number.isInteger(startNumber) &&
    startNumber >= 1 &&
    startNumber <= TOTAL_QUESTIONS;

  const handleSequentialStart = () => {
    if (!startValid) return;
    setSeqSheetOpen(false);
    router.push(`/quiz/play?mode=sequential&start=${startNumber}`);
  };

  const totalAnswered = stats?.totalAnswered ?? 0;
  const totalCorrect = stats?.totalCorrect ?? 0;
  const accuracy =
    totalAnswered === 0
      ? 0
      : Math.round((totalCorrect / totalAnswered) * 100);
  const wrongCount = notes?.length ?? 0;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
      <PageHeader title="문제 풀기" />

      {/* 진도 카드 */}
      <section className="rounded-2xl border border-[#ebe9f5] bg-white p-5">
        <div className="grid grid-cols-2 divide-x divide-[#ebe9f5]">
          <div className="flex flex-col items-center gap-1 px-2">
            <Flag size={20} strokeWidth={1.5} className="text-violet-500" />
            <span className="text-xs font-medium text-slate-400">진도</span>
            <span className="text-xl font-bold text-slate-900 tabular-nums">
              {totalAnswered}/1000
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 px-2">
            <Trophy size={20} strokeWidth={1.5} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-400">정답률</span>
            <span className="text-xl font-bold text-slate-900 tabular-nums">
              {accuracy}%
            </span>
          </div>
        </div>
      </section>

      {/* 메뉴 그리드 */}
      <section className="grid grid-cols-2 gap-3">
        <MenuCard
          icon={<ClipboardList {...iconProps} />}
          color="blue"
          title="모의고사 응시"
          subtitle="실전 40문제 · 40분"
          onClick={() => setSheetOpen(true)}
        />
        <MenuCard
          icon={<XCircle {...iconProps} />}
          color="rose"
          title="오답 다시 풀기"
          subtitle="틀린 문제 모음"
          badge={wrongCount === 0 ? undefined : wrongCount}
          onClick={() => router.push("/notes")}
        />
        <MenuCard
          icon={<FileText {...iconProps} />}
          color="violet"
          title="문제 풀기"
          subtitle="유형별 · 랜덤 40문제"
          onClick={() => setTypeSheetOpen(true)}
        />
        <MenuCard
          icon={<ListOrdered {...iconProps} />}
          color="indigo"
          title="순서대로 풀기"
          subtitle="번호부터 차례대로"
          onClick={() => setSeqSheetOpen(true)}
        />
        <MenuCard
          icon={<Star {...iconProps} />}
          color="amber"
          title="즐겨찾기 문제"
          subtitle="저장한 문제 모음"
          onClick={() => router.push("/favorites")}
        />
        <MenuCard
          icon={<TrendingUp {...iconProps} />}
          color="violet"
          title="통계 보기"
          subtitle="전체 풀이 분석"
          onClick={() => router.push("/stats")}
        />
        <MenuCard
          icon={<History {...iconProps} />}
          color="teal"
          title="모의고사 이력"
          subtitle="지난 응시 기록"
          onClick={() => router.push("/quiz/history")}
        />
      </section>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="모의고사 면허 종류"
        subtitle="응시할 면허를 선택하면 합격 기준이 적용됩니다."
      >
        <div className="space-y-2.5">
          {LICENSE_TYPES.map((L) => (
            <OptionRow
              key={L.id}
              icon={<L.icon size={24} strokeWidth={1.5} />}
              color={L.color}
              title={L.label}
              subtitle={`합격 기준: ${L.passScore}점 이상`}
              onClick={() => {
                setSheetOpen(false);
                router.push(`/quiz/play?mode=mock&license=${L.id}`);
              }}
            />
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={typeSheetOpen}
        onClose={() => setTypeSheetOpen(false)}
        title="문제 유형 선택"
        subtitle="유형을 선택하면 해당 유형에서 랜덤 40문제가 출제됩니다."
      >
        <div className="space-y-2.5">
          {/* 전체 — 유형 무관 랜덤 (기존 동작) */}
          <OptionRow
            icon={<Shuffle {...iconProps} />}
            color="violet"
            title="전체"
            subtitle="모든 유형 랜덤 40문제"
            onClick={() => {
              setTypeSheetOpen(false);
              router.push("/quiz/play?mode=random");
            }}
          />
          {QUESTION_TYPES.map((t) => {
            const style = TYPE_STYLE[t.value];
            return (
              <OptionRow
                key={t.value}
                icon={style?.icon ?? <FileText {...iconProps} />}
                color={style?.color ?? "violet"}
                title={t.label}
                subtitle={style?.subtitle}
                onClick={() => {
                  setTypeSheetOpen(false);
                  router.push(
                    `/quiz/play?mode=random&type=${encodeURIComponent(t.value)}`,
                  );
                }}
              />
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet
        open={seqSheetOpen}
        onClose={() => setSeqSheetOpen(false)}
        title="순서대로 풀기"
        subtitle={`시작할 문제 번호를 입력하세요 (1~${TOTAL_QUESTIONS}). 그 번호부터 차례대로 출제됩니다.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSequentialStart();
          }}
          className="space-y-4"
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={TOTAL_QUESTIONS}
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            aria-label="시작 문제 번호"
            autoFocus
            className="w-full rounded-xl border border-[#ebe9f5] px-4 py-3 text-base text-slate-900 tabular-nums focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <Button type="submit" disabled={!startValid} className="w-full">
            {startValid
              ? `${startNumber}번부터 풀기`
              : `1~${TOTAL_QUESTIONS} 사이 번호`}
          </Button>
        </form>
      </BottomSheet>
    </main>
  );
}
