"use client";

import { useQuery } from "@tanstack/react-query";
import { getMockHistory } from "@/lib/services/mockHistoryService";

export const MOCK_HISTORY_KEY = ["mockHistory"];

/**
 * 모의고사 이력 조회.
 * - mockHistoryService(localStorage)만 사용. 이 step은 read 전용.
 * - 기록(write)은 결과 페이지가 addMockResult를 직접 호출한다.
 */
export function useMockHistory() {
  return useQuery({
    queryKey: MOCK_HISTORY_KEY,
    queryFn: () => getMockHistory(),
  });
}
