"use client";

import { useQuery } from "@tanstack/react-query";
import { loadStudyIndex, loadStudyTopic } from "@/lib/services/studyService";

/** 학습 토픽 목록(public/data/study/index.json) 캐싱 로드. */
export function useStudyIndex() {
  return useQuery({
    queryKey: ["studyIndex"],
    queryFn: loadStudyIndex,
    // 정적 콘텐츠 — 세션 동안 다시 가져올 필요 없음
    staleTime: Infinity,
  });
}

/** 학습 토픽 상세(public/data/study/{id}.json) 캐싱 로드. */
export function useStudyTopic(id: number) {
  return useQuery({
    queryKey: ["studyTopic", id],
    queryFn: () => loadStudyTopic(id),
    // 정적 콘텐츠 — 세션 동안 다시 가져올 필요 없음
    staleTime: Infinity,
  });
}
