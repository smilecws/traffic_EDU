"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStats } from "@/lib/hooks/useStats";
import { useGlobalStats } from "@/lib/hooks/useGlobalStats";
import { useQuestions } from "@/lib/hooks/useQuestions";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { QuizCard } from "@/components/quiz/QuizCard";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Spinner } from "@/components/shared/Spinner";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

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

  // 즐겨찾기 — 목록의 ⭐와 펼친 문제 카드의 ⭐가 같은 상태를 공유한다.
  const { data: favorites, toggleFavorite } = useFavorites();
  const favoriteIds = useMemo(
    () => new Set((favorites ?? []).map((f) => f.questionId)),
    [favorites],
  );

  /** 펼쳐 둔 문제 — 한 번에 하나만 펼쳐 목록이 지나치게 길어지지 않게 한다. */
  const [openId, setOpenId] = useState<string | null>(null);

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
                <TopQuestionItem
                  key={entry.questionId}
                  rank={index + 1}
                  question={question}
                  wrong={entry.wrong}
                  attempts={entry.attempts}
                  wrongRate={entry.wrongRate}
                  open={openId === entry.questionId}
                  onToggleOpen={() =>
                    setOpenId((prev) =>
                      prev === entry.questionId ? null : entry.questionId,
                    )
                  }
                  isFavorite={favoriteIds.has(entry.questionId)}
                  onToggleFavorite={() => toggleFavorite(entry.questionId)}
                />
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

/**
 * Top 50의 한 줄. 줄을 누르면 그 자리에서 문제와 보기가 펼쳐진다.
 *
 * 펼쳐도 정답·해설은 바로 보여 주지 않는다. 많이 틀리는 문제일수록 직접 골라
 * 보고 확인하는 편이 복습이 되기 때문이다. "정답 확인"을 누르면 채점 화면과
 * 같은 방식으로 정답과 해설이 나온다. 고르지 않고 눌러도 정답은 볼 수 있다.
 */
function TopQuestionItem({
  rank,
  question,
  wrong,
  attempts,
  wrongRate,
  open,
  onToggleOpen,
  isFavorite,
  onToggleFavorite,
}: {
  rank: number;
  question: Question;
  wrong: number;
  attempts: number;
  wrongRate: number;
  open: boolean;
  onToggleOpen: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const panelId = `top-question-${question.id}`;

  function handleToggleOpen() {
    // 접었다 다시 펼치면 새로 풀 수 있게 처음 상태로 되돌린다.
    if (open) {
      setSelectedIds([]);
      setSubmitted(false);
    }
    onToggleOpen();
  }

  function handleChoice(id: number) {
    if (submitted) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <li>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleToggleOpen}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#f5f4fb]"
        >
          <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-400">
            {rank}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block text-sm text-slate-900",
                !open && "line-clamp-2",
              )}
            >
              {question.question}
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              {question.number}번 · 오답 {wrong}/{attempts}
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-red-500">
            {Math.round(wrongRate * 100)}%
          </span>
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            aria-hidden
            className={cn(
              "shrink-0 text-slate-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={
            isFavorite
              ? `${question.number}번 즐겨찾기 해제`
              : `${question.number}번 즐겨찾기 추가`
          }
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Star
            strokeWidth={1.5}
            className={cn(
              "h-5 w-5",
              isFavorite && "fill-amber-500 text-amber-500",
            )}
          />
        </button>
      </div>

      {open && (
        <div id={panelId} className="space-y-3 px-1 pb-3 pt-1">
          <QuizCard
            question={question}
            selectedIds={selectedIds}
            submitted={submitted}
            onToggle={handleChoice}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
          />
          {submitted ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSelectedIds([]);
                setSubmitted(false);
              }}
            >
              다시 풀기
            </Button>
          ) : (
            <Button className="w-full" onClick={() => setSubmitted(true)}>
              정답 확인
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/** 집계 시각(ISO8601)을 사람이 읽기 좋은 형태로. 파싱 실패 시 원문 표시. */
function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR");
}
