"use client";

import { useQuery } from "@tanstack/react-query";
import { getSessionResult } from "@/lib/services/sessionResultService";

/**
 * 결과 페이지 표시용 세션 상세를 id로 조회 (localStorage, service 경유).
 * 다른 데이터 hook과 동일하게 useQuery로 읽어 SSR/hydration 안전하게 처리.
 */
export function useSessionResult(id: string) {
  return useQuery({
    queryKey: ["sessionResult", id],
    queryFn: () => getSessionResult(id),
  });
}
