"use client";

import { useQuery } from "@tanstack/react-query";
import { loadQuestions } from "@/lib/services/questionsService";

/** 문제 데이터(public/data/questions_kor.json) 캐싱 로드. */
export function useQuestions() {
  return useQuery({
    queryKey: ["questions"],
    queryFn: loadQuestions,
    // 정적 콘텐츠 — 세션 동안 다시 가져올 필요 없음
    staleTime: Infinity,
  });
}
