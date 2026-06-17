"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { TopicRow } from "@/components/shared/TopicRow";
import { Spinner } from "@/components/shared/Spinner";
import type { TileColor } from "@/components/shared/IconTile";
import { useStudyIndex } from "@/lib/hooks/useStudy";

// IconTile 7색 순환 (green→violet→indigo→rose→amber→blue→teal→…)
const TILE_COLORS: TileColor[] = [
  "green",
  "violet",
  "indigo",
  "rose",
  "amber",
  "blue",
  "teal",
];

export default function StudyPage() {
  const router = useRouter();
  const { data: topics, isLoading } = useStudyIndex();

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
      <PageHeader title="학습하기" />

      <p className="text-sm text-slate-500 leading-relaxed">
        주제별 학습 카드로 핵심 개념과 시험 출제 포인트를 정리해 보세요.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : topics && topics.length > 0 ? (
        <div className="space-y-2.5">
          {topics.map((t, i) => (
            <TopicRow
              key={t.id}
              index={t.id}
              color={TILE_COLORS[i % TILE_COLORS.length]}
              title={t.title}
              onClick={() => router.push(`/study/${t.id}`)}
            />
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-slate-400">
          학습 데이터를 불러올 수 없습니다.
        </p>
      )}
    </main>
  );
}
