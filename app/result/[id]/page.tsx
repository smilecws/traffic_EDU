"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Question } from "@/lib/types";
import { useQuestions } from "@/lib/hooks/useQuestions";
import { useSessionResult } from "@/lib/hooks/useSessionResult";
import { useStats } from "@/lib/hooks/useStats";
import { useFavorites } from "@/lib/hooks/useFavorites";
import {
  isSessionSaved,
  markSessionSaved,
} from "@/lib/services/sessionResultService";
import { logAnswers } from "@/lib/services/answerLogService";
import { addMockResult } from "@/lib/services/mockHistoryService";
import { getLicense } from "@/lib/data/licenses";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Spinner } from "@/components/shared/Spinner";
import { QuizCard } from "@/components/quiz/QuizCard";

export default function ResultPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data: questions } = useQuestions();
  // 결과 상세는 퀴즈 페이지가 저장해 둔 것을 id로 조회 (새로고침에도 유지).
  const { data: detail, isLoading: detailLoading } = useSessionResult(id);
  const { recordSessionComplete } = useStats();
  const { data: favorites, toggleFavorite } = useFavorites();

  // 저장(통계/오답노트/익명 집계)은 세션당 1회만.
  // 멱등성: 저장 완료 세션 id를 localStorage에 기록 → 새로고침 중복 저장 방지.
  const savedRef = useRef(false);
  useEffect(() => {
    if (savedRef.current || !detail || !questions) return;
    savedRef.current = true;

    if (isSessionSaved(detail.result.id)) return;

    // 세션 완료 횟수만 +1 (문제별 정답/오답·오답노트는 풀이 중에 이미 기록됨).
    recordSessionComplete();

    // 답한 문제 → 익명 집계 (Firestore, best-effort). 오답률 산출용 전체 시도 기록.
    // 개인 식별 정보 없음. 미응답(빈 선택)은 logAnswers 내부에서 제외한다.
    void logAnswers(detail.results);

    // 모의고사면 이력에도 1회 기록 (멱등 가드 안 → 새로고침 중복 방지, localStorage 전용).
    const meta = detail.meta;
    if (meta?.mode === "mock") {
      const licenseId = meta.licenseId ?? "";
      const passScore = meta.passScore ?? 0;
      addMockResult({
        id: detail.result.id,
        licenseId,
        licenseLabel: getLicense(licenseId)?.label ?? licenseId,
        passScore,
        scorePercent: detail.result.scorePercent,
        correctCount: detail.result.correctCount,
        total: detail.result.total,
        passed: detail.result.scorePercent >= passScore,
        finishedAt: detail.result.finishedAt,
      });
    }

    markSessionSaved(detail.result.id);
  }, [detail, questions, recordSessionComplete]);

  if (detailLoading || !questions) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-32">
        <Spinner label="결과를 불러오는 중" />
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-16 md:px-6">
        <h1 className="text-2xl font-bold text-slate-900">
          결과를 찾을 수 없습니다
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          저장된 세션 결과가 없습니다. 새 퀴즈를 풀어 보세요.
        </p>
        <div>
          <Button onClick={() => router.push("/quiz/play")}>퀴즈 풀기</Button>
        </div>
      </main>
    );
  }

  const { result, results, meta } = detail;
  const byId = new Map<string, Question>(questions.map((q) => [q.id, q]));
  const wrongs = results.filter((r) => !r.correct);
  // 모의고사 전체 리뷰 — 문제 번호순 정렬(응시 순서는 보관하지 않으므로).
  const review = [...results].sort(
    (a, b) =>
      (byId.get(a.questionId)?.number ?? 0) -
      (byId.get(b.questionId)?.number ?? 0),
  );

  // 모의고사 합격/불합격 배너 데이터
  const isMock = meta?.mode === "mock";
  const passScore = meta?.passScore ?? 0;
  const passed = result.scorePercent >= passScore;
  const licenseLabel = meta?.licenseId
    ? getLicense(meta.licenseId)?.label ?? meta.licenseId
    : "";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-12 px-4 py-12 md:px-6">
      {/* 뒤로가기 — 히스토리 pop(연 화면으로 복귀). 끝난 퀴즈는 replace로 진입해
          뒤로가기 시 풀이 화면이 아니라 그 이전(허브/이력)으로 간다. */}
      <div className="-mb-6 flex items-center">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로"
          className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-[#f5f4fb]"
        >
          <ArrowLeft size={24} strokeWidth={1.5} />
        </button>
      </div>

      {/* 모의고사 합격/불합격 배너 */}
      {isMock && (
        <Card
          className={
            passed
              ? "space-y-1 border-emerald-200 bg-emerald-50"
              : "space-y-1 border-red-200 bg-red-50"
          }
        >
          <p className="text-sm font-medium text-slate-600">
            {licenseLabel} 모의고사
          </p>
          <p
            className={
              passed
                ? "text-2xl font-bold text-emerald-600"
                : "text-2xl font-bold text-red-600"
            }
          >
            {passed ? "합격" : "불합격"}
          </p>
          <p className="text-sm text-slate-600 tabular-nums">
            합격 기준 {passScore}점 / 내 점수 {result.scorePercent}점
          </p>
        </Card>
      )}

      {/* 점수 요약 */}
      <section className="space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
          퀴즈 결과
        </h1>
        <Card className="space-y-4 border-[#ebe9f5] bg-white">
          <div className="flex items-end justify-between">
            <span className="text-sm text-slate-600">정답률</span>
            <span className="tabular-nums font-mono text-3xl font-bold text-emerald-500">
              {result.scorePercent}%
            </span>
          </div>
          <ProgressBar
            value={result.scorePercent}
            max={100}
            className="bg-[#ebe9f5]"
          />
          <p className="text-xs text-slate-400 tabular-nums">
            총 {result.total}문제 중 {result.correctCount}문제 정답
          </p>
        </Card>
      </section>

      {/* 모의고사: 전체 문제 리뷰 (문제·내 선택·정답·해설). 그 외: 오답 목록만. */}
      {isMock ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">
            전체 문제 리뷰 {review.length}문제
          </h2>
          <div className="space-y-4">
            {review.map((r) => {
              const q = byId.get(r.questionId);
              if (!q) return null;
              return (
                <QuizCard
                  key={r.questionId}
                  question={q}
                  selectedIds={r.selectedIds}
                  submitted
                  onToggle={() => {}}
                  isFavorite={
                    favorites?.some((f) => f.questionId === q.id) ?? false
                  }
                  onToggleFavorite={() => toggleFavorite(q.id)}
                />
              );
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">
            오답 {wrongs.length}문제
          </h2>
          {wrongs.length === 0 ? (
          <Card className="border-[#ebe9f5] bg-white">
            <p className="text-sm text-slate-600 leading-relaxed">
              틀린 문제가 없습니다. 완벽합니다!
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {wrongs.map((w) => {
              const q = byId.get(w.questionId);
              if (!q) return null;
              const mine = q.choices
                .filter((c) => w.selectedIds.includes(c.id))
                .map((c) => c.text)
                .join(", ");
              const correct = q.choices
                .filter((c) => q.answerIds.includes(c.id))
                .map((c) => c.text)
                .join(", ");
              return (
                <Card
                  key={w.questionId}
                  className="space-y-4 border-[#ebe9f5] bg-white"
                >
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
                </Card>
              );
            })}
          </div>
          )}
        </section>
      )}

      {/* 액션 */}
      <section className="flex flex-wrap gap-3">
        <Button onClick={() => router.push("/quiz/play")}>다시 풀기</Button>
        <Button variant="secondary" onClick={() => router.push("/quiz")}>
          문제 풀기
        </Button>
        <Button variant="secondary" onClick={() => router.push("/notes")}>
          오답노트 보기
        </Button>
      </section>
    </main>
  );
}
