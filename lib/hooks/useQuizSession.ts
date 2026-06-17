"use client";

import { useCallback, useState } from "react";
import type {
  QuestionResult,
  QuizMode,
  QuizSession,
  SessionResult,
} from "@/lib/types";
import { loadQuestions } from "@/lib/services/questionsService";
import { getWrongNotes } from "@/lib/services/wrongNoteService";
import { getFavorites } from "@/lib/services/favoriteService";
import { buildQuizQuestions } from "@/lib/utils/buildQuizQuestions";
import { gradeSession, isAnswerCorrect } from "@/lib/utils/calculateScore";

/**
 * 퀴즈 진행 상태 관리 hook.
 * - 문제 로드/구성은 service + util만 사용한다 (localStorage/Firestore 직접 접근 없음).
 * - 채점은 gradeSession을 재사용한다 (로직 재구현 금지).
 */
export function useQuizSession() {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<QuizMode>("random");
  const [license, setLicense] = useState<string | undefined>(undefined);

  /**
   * 문제 로드 → 모드별 구성 → 새 세션 생성.
   * 기본 호출(startSession())은 random 모드로 동작한다(하위 호환).
   */
  const startSession = useCallback(
    async (opts?: {
      mode?: QuizMode;
      license?: string;
      type?: string;
      startNumber?: number;
      questionIds?: string[];
    }): Promise<QuizSession> => {
      const nextMode = opts?.mode ?? "random";
      const nextLicense = opts?.license;
      setLoading(true);
      try {
        const all = await loadQuestions();
        // wrong/favorite 모드일 때만 개인 데이터 id를 service 경유로 수집한다.
        const wrongIds =
          nextMode === "wrong"
            ? // 최근 오답 우선 — 호출측(hook)에서 정렬해 넘긴다.
              [...getWrongNotes()]
                .sort((a, b) => b.addedAt - a.addedAt)
                .map((n) => n.questionId)
            : [];
        const favoriteIds =
          nextMode === "favorite"
            ? getFavorites().map((f) => f.questionId)
            : [];
        const picked = buildQuizQuestions(
          nextMode,
          { all, wrongIds, favoriteIds },
          {
            type: opts?.type,
            startNumber: opts?.startNumber,
            questionIds: opts?.questionIds,
          },
        );
        const newSession: QuizSession = {
          id: `session-${Date.now()}`,
          questions: picked,
          results: [],
          startedAt: Date.now(),
          finishedAt: null,
        };
        setSession(newSession);
        setCurrentIndex(0);
        setMode(nextMode);
        setLicense(nextLicense);
        return newSession;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * 현재 문제 답안 기록(채점만, 진행 X).
   * 복수 정답은 선택 집합이 정답 집합과 완전히 일치할 때만 정답.
   * 진행(다음 문제)은 피드백 표시 후 next()로 분리한다.
   */
  const answer = useCallback((questionId: string, selectedIds: number[]) => {
    setSession((prev) => {
      if (!prev) return prev;
      const q = prev.questions.find((x) => x.id === questionId);
      if (!q) return prev;
      const result: QuestionResult = {
        questionId,
        selectedIds,
        correct: isAnswerCorrect(selectedIds, q.answerIds),
      };
      // 같은 문제 재답안 시 갱신
      const results = [
        ...prev.results.filter((r) => r.questionId !== questionId),
        result,
      ];
      return { ...prev, results };
    });
  }, []);

  /** 다음 문제로 진행. */
  const next = useCallback(() => {
    setCurrentIndex((i) => i + 1);
  }, []);

  /**
   * 세션 채점 → 결과 반환. finishedAt은 hook 내부에서 주입.
   * @param opts.fillUnansweredAsWrong true면 미응답 문제를 오답으로 채워
   *   분모가 전체 문제 수가 되도록 한다(모의고사 합격 판정 정확성).
   */
  const finish = useCallback(
    (opts?: {
      fillUnansweredAsWrong?: boolean;
    }): { result: SessionResult; results: QuestionResult[] } | null => {
      if (!session) return null;
      const finishedAt = Date.now();

      let results = session.results;
      if (opts?.fillUnansweredAsWrong) {
        const answeredIds = new Set(results.map((r) => r.questionId));
        const fills: QuestionResult[] = session.questions
          .filter((q) => !answeredIds.has(q.id))
          .map((q) => ({ questionId: q.id, selectedIds: [], correct: false }));
        results = [...results, ...fills];
      }

      const result = gradeSession(results, {
        id: session.id,
        finishedAt,
      });
      setSession((prev) => (prev ? { ...prev, finishedAt } : prev));
      // 채점에 쓴 results(미응답 채움 포함)를 함께 반환해야 오답노트/집계에
      // 미응답 문제까지 반영된다. session.results만 저장하면 채움분이 누락된다.
      return { result, results };
    },
    [session],
  );

  const total = session?.questions.length ?? 0;
  const currentQuestion = session?.questions[currentIndex] ?? null;
  const isComplete = total > 0 && currentIndex >= total;
  const progress = total === 0 ? 0 : Math.min(currentIndex / total, 1);

  return {
    session,
    currentIndex,
    currentQuestion,
    total,
    progress,
    isComplete,
    loading,
    mode,
    license,
    startSession,
    answer,
    next,
    finish,
  };
}
