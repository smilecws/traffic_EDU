"use client";

import { useRouter } from "next/navigation";
import type { Question } from "@/lib/types";
import { useQuestions } from "@/lib/hooks/useQuestions";
import { useWrongNotes } from "@/lib/hooks/useWrongNotes";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { Spinner } from "@/components/shared/Spinner";

export default function NotesPage() {
  const router = useRouter();
  // 데이터는 hook(localStorage/JSON)만 경유 — 페이지에서 직접 접근 없음.
  const {
    data: notes,
    isLoading: notesLoading,
    removeWrongNote,
  } = useWrongNotes();
  const { data: questions, isLoading: questionsLoading } = useQuestions();

  if (notesLoading || questionsLoading || !questions) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
        <PageHeader title="오답노트" />
        <div className="flex items-center justify-center py-32">
          <Spinner label="오답노트를 불러오는 중" />
        </div>
      </main>
    );
  }

  const list = notes ?? [];
  const byId = new Map<string, Question>(questions.map((q) => [q.id, q]));
  // 오답노트에 있지만 문제 데이터가 있는 항목만 표시.
  const items = list.filter((n) => byId.has(n.questionId));

  // 빈 상태 — 오답노트가 비어 있음.
  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
        <PageHeader title="오답노트" />
        <div>
          <Button disabled>오답 다시 풀기</Button>
        </div>
        <Card className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            아직 오답노트에 담긴 문제가 없습니다. 퀴즈를 풀고 틀린 문제가
            생기면 여기에서 다시 복습할 수 있습니다.
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
      <PageHeader title="오답노트" />

      <p className="text-sm text-slate-600 leading-relaxed">
        틀린 문제 {items.length}개를 다시 보고 복습하세요.
      </p>

      <div>
        <Button
          disabled={items.length === 0}
          onClick={() => router.push("/quiz/play?mode=wrong")}
        >
          오답 다시 풀기
        </Button>
      </div>

      <section className="space-y-4">
        {items.map((note) => {
          const q = byId.get(note.questionId)!;
          const mine = q.choices
            .filter((c) => note.selectedIds.includes(c.id))
            .map((c) => c.text)
            .join(", ");
          const correct = q.choices
            .filter((c) => q.answerIds.includes(c.id))
            .map((c) => c.text)
            .join(", ");
          return (
            <Card key={note.questionId} className="space-y-4">
              <Badge variant="info">{q.number}번</Badge>
              <p className="text-base font-medium text-slate-900 leading-relaxed">
                {q.question}
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Badge variant="danger" className="shrink-0">
                    내 답
                  </Badge>
                  <span className="text-slate-600">
                    {mine || "(선택 없음)"}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="success" className="shrink-0">
                    정답
                  </Badge>
                  <span className="text-slate-600">{correct || "-"}</span>
                </div>
              </div>

              <div className="rounded-lg border border-[#ebe9f5] bg-[#f5f4fb] p-4">
                <p className="text-xs font-medium text-slate-400">해설</p>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  {q.explanation}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    router.push(`/quiz/play?ids=${note.questionId}`)
                  }
                >
                  다시 풀기
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => removeWrongNote(note.questionId)}
                >
                  삭제
                </Button>
              </div>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
