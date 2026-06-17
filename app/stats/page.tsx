"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStats } from "@/lib/hooks/useStats";
import { useGlobalStats } from "@/lib/hooks/useGlobalStats";
import { useQuestions } from "@/lib/hooks/useQuestions";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Spinner } from "@/components/shared/Spinner";
import type { Question } from "@/lib/types";

export default function StatsPage() {
  const router = useRouter();
  const { data: stats, isLoading: statsLoading } = useStats();

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-6">
      <PageHeader title="학습 통계" />

      {/* 개인 누적 정답률 요약 (localStorage) */}
      <PersonalSummary loading={statsLoading} stats={stats} router={router} />

      {/* 개인 오답 — 오답노트(/notes)로 일원화. 새 화면을 만들지 않는다. */}
      <section className="space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          내가 틀린 문제는 오답노트에서 확인하고 다시 복습할 수 있습니다.
        </p>
        <Button variant="secondary" onClick={() => router.push("/notes")}>
          오답노트에서 복습하기
        </Button>
      </section>

      {/* 전체 사용자 오답 집계 — 많이 틀린 문제 Top 50 (정적 JSON) */}
      <GlobalTop50 />
    </main>
  );
}

/** 개인 누적 정답률 요약 카드. 빈/로딩 상태를 자체 처리한다. */
function PersonalSummary({
  loading,
  stats,
  router,
}: {
  loading: boolean;
  stats: ReturnType<typeof useStats>["data"];
  router: ReturnType<typeof useRouter>;
}) {
  if (loading) {
    return (
      <Card className="flex items-center justify-center py-12">
        <Spinner label="학습 통계를 불러오는 중" />
      </Card>
    );
  }

  const totalAnswered = stats?.totalAnswered ?? 0;

  // 빈 상태 — 아직 푼 문제가 없음.
  if (!stats || totalAnswered === 0) {
    return (
      <Card className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          아직 푼 문제가 없습니다. 첫 퀴즈를 풀면 누적 정답률이 여기에
          표시됩니다.
        </p>
        <div>
          <Button onClick={() => router.push("/quiz/play")}>퀴즈 시작</Button>
        </div>
      </Card>
    );
  }

  const accuracy = Math.round((stats.totalCorrect / totalAnswered) * 100);

  return (
    <Card className="space-y-4">
      <div className="flex items-end justify-between">
        <span className="text-sm text-slate-600">누적 정답률</span>
        <span className="tabular-nums font-mono text-4xl font-bold text-emerald-500">
          {accuracy}%
        </span>
      </div>
      <ProgressBar value={accuracy} max={100} />
      <p className="text-xs text-slate-400 tabular-nums">
        총 {totalAnswered}문제 중 {stats.totalCorrect}문제 정답 · 세션{" "}
        {stats.totalSessions}회
      </p>
    </Card>
  );
}

/**
 * 오답률 높은 문제 Top 50 섹션.
 * useGlobalStats(정적 JSON)로 집계를 가져와 useQuestions로 문제 텍스트를 조인한다.
 * 집계가 이미 오답률순으로 제공하므로 그대로 렌더한다.
 * 집계 미구성/집계 전(null·빈 배열)은 에러가 아니라 안내로 처리한다.
 */
function GlobalTop50() {
  const { data: aggregate, isLoading: aggregateLoading } = useGlobalStats();
  const { data: questions, isLoading: questionsLoading } = useQuestions();

  // questionId → Question 조인 맵.
  const questionById = useMemo(() => {
    const map = new Map<string, Question>();
    for (const q of questions ?? []) map.set(q.id, q);
    return map;
  }, [questions]);

  const loading = aggregateLoading || questionsLoading;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">
        오답률 높은 문제 Top 50
      </h2>

      {loading ? (
        <Card className="flex items-center justify-center py-12">
          <Spinner label="전체 통계를 불러오는 중" />
        </Card>
      ) : !aggregate || aggregate.top.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600 leading-relaxed">
            아직 집계된 데이터가 없습니다. 잠시 후 다시 확인해 주세요.
          </p>
        </Card>
      ) : (
        <Card className="space-y-1 p-2">
          <ol className="divide-y divide-[#ebe9f5]">
            {aggregate.top.map((entry, index) => {
              const question = questionById.get(entry.questionId);
              // 데이터 불일치(집계에만 있는 questionId) — 안전하게 건너뜀.
              if (!question) return null;
              return (
                <li
                  key={entry.questionId}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">
                      {question.question}
                    </p>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {question.number}번 · 오답 {entry.wrong}/{entry.attempts}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-red-500">
                    {Math.round(entry.wrongRate * 100)}%
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="px-3 pt-1 text-xs text-slate-400">
            업데이트: {formatUpdatedAt(aggregate.updatedAt)}
          </p>
        </Card>
      )}
    </section>
  );
}

/** 집계 시각(ISO8601)을 사람이 읽기 좋은 형태로. 파싱 실패 시 원문 표시. */
function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR");
}
