"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getStats,
  recordAnswer,
  recordSessionComplete,
} from "@/lib/services/statsService";

const STATS_KEY = ["stats"];

/**
 * 누적 학습 통계 조회 + 기록.
 * - 조회는 getStats(), 기록은 recordAnswer()(문제당)/recordSessionComplete()(세션당) — localStorage.
 * - 기록(mutation) 후 통계 쿼리를 invalidate 하여 UI 갱신.
 */
export function useStats() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: STATS_KEY });

  const query = useQuery({
    queryKey: STATS_KEY,
    queryFn: () => getStats(),
  });

  const answerMutation = useMutation({
    mutationFn: async (correct: boolean) => recordAnswer(correct),
    onSuccess: invalidate,
  });

  const sessionMutation = useMutation({
    mutationFn: async () => recordSessionComplete(),
    onSuccess: invalidate,
  });

  return {
    ...query,
    recordAnswer: answerMutation.mutate,
    recordSessionComplete: sessionMutation.mutate,
  };
}
