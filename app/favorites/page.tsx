"use client";

import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import type { Question } from "@/lib/types";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useQuestions } from "@/lib/hooks/useQuestions";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { Spinner } from "@/components/shared/Spinner";

export default function FavoritesPage() {
  const router = useRouter();
  // 데이터는 hook(localStorage/JSON)만 경유 — 페이지에서 직접 접근 없음.
  const {
    data: favorites,
    isLoading: favoritesLoading,
    toggleFavorite,
  } = useFavorites();
  const { data: questions, isLoading: questionsLoading } = useQuestions();

  if (favoritesLoading || questionsLoading || !questions) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
        <PageHeader title="즐겨찾기" />
        <div className="flex items-center justify-center py-32">
          <Spinner label="즐겨찾기를 불러오는 중" />
        </div>
      </main>
    );
  }

  const list = favorites ?? [];
  const byId = new Map<string, Question>(questions.map((q) => [q.id, q]));
  // 즐겨찾기에 있지만 문제 데이터가 있는 항목만 표시.
  const items = list.filter((f) => byId.has(f.questionId));

  // 빈 상태 — 즐겨찾기가 비어 있음.
  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
        <PageHeader title="즐겨찾기" />
        <div>
          <Button disabled>즐겨찾기 문제 풀기</Button>
        </div>
        <Card className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            아직 즐겨찾기한 문제가 없습니다. 퀴즈를 풀면서 중요하거나 약한
            문제를 즐겨찾기에 담아 복습하세요.
          </p>
          <div>
            <Button onClick={() => router.push("/quiz/play")}>퀴즈 시작</Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
      <PageHeader title="즐겨찾기" />

      <p className="text-sm text-slate-600 leading-relaxed">
        즐겨찾기한 문제 {items.length}개입니다.
      </p>

      <div>
        <Button
          disabled={items.length === 0}
          onClick={() => router.push("/quiz/play?mode=favorite")}
        >
          즐겨찾기 문제 풀기
        </Button>
      </div>

      <section className="space-y-4">
        {items.map((fav) => {
          const q = byId.get(fav.questionId)!;
          const correct = q.choices
            .filter((c) => q.answerIds.includes(c.id))
            .map((c) => c.text)
            .join(", ");
          return (
            <Card key={fav.questionId} className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <Badge variant="info">{q.number}번</Badge>
                <button
                  type="button"
                  onClick={() => toggleFavorite(fav.questionId)}
                  aria-label="즐겨찾기 해제"
                  className="rounded-md p-1 text-amber-500 transition-colors hover:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <Star strokeWidth={1.5} className="h-5 w-5 fill-amber-500" />
                </button>
              </div>

              <p className="text-base font-medium text-slate-900 leading-relaxed">
                {q.question}
              </p>

              <div className="flex items-start gap-2 text-sm">
                <Badge variant="success" className="shrink-0">
                  정답
                </Badge>
                <span className="text-slate-600">{correct || "-"}</span>
              </div>

              <div className="rounded-lg border border-[#ebe9f5] bg-[#f5f4fb] p-4">
                <p className="text-xs font-medium text-slate-400">해설</p>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  {q.explanation}
                </p>
              </div>

              <div>
                <Button
                  variant="secondary"
                  onClick={() => toggleFavorite(fav.questionId)}
                >
                  즐겨찾기 해제
                </Button>
              </div>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
