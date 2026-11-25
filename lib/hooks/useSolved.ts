"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearSolved, getSolvedIds } from "@/lib/services/solvedService";

const SOLVED_KEY = ["solved"];

/** 푼 문제 집합 조회 + 기록 초기화 (localStorage). */
export function useSolved() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SOLVED_KEY,
    queryFn: () => new Set(getSolvedIds()),
  });

  const reset = useMutation({
    mutationFn: async () => clearSolved(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOLVED_KEY }),
  });

  return { ...query, resetSolved: reset.mutate };
}
