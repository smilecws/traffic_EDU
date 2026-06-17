"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { GlobalAggregate } from "@/lib/types";
import { loadGlobalAggregate } from "@/lib/services/globalStatsService";

/**
 * 전체 사용자 오답 집계(aggregates.json) 캐싱 로드.
 * service만 경유한다(직접 fetch/localStorage 접근은 service 내부에서만).
 */
export function useGlobalStats(): UseQueryResult<GlobalAggregate | null> {
  return useQuery({
    queryKey: ["globalStats"],
    queryFn: loadGlobalAggregate,
    staleTime: 60 * 60 * 1000, // 1시간
  });
}
