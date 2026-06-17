"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionResult } from "@/lib/types";
import { getStats, recordSession } from "@/lib/services/statsService";

const STATS_KEY = ["stats"];

/**
 * 누적 학습 통계 조회 + 세션 기록.
 * - 조회는 statsService.getStats(), 기록은 recordSession() (localStorage)만 사용.
 * - 기록(mutation) 후 통계 쿼리를 invalidate 하여 UI 갱신.
 */
export function useStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: STATS_KEY,
    queryFn: () => getStats(),
  });

  const mutation = useMutation({
    mutationFn: async (result: SessionResult) => recordSession(result),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: STATS_KEY }),
  });

  return {
    ...query,
    recordSession: mutation.mutate,
    recording: mutation.isPending,
  };
}
