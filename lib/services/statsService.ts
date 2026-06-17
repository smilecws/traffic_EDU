import type { SessionResult, UserStats } from "@/lib/types";
import { getItem, setItem } from "@/lib/utils/storage";

const STATS_KEY = "quiz:stats";

const EMPTY_STATS: UserStats = {
  totalSessions: 0,
  totalAnswered: 0,
  totalCorrect: 0,
};

/** 누적 학습 통계를 반환한다 (localStorage). */
export function getStats(): UserStats {
  return getItem<UserStats>(STATS_KEY, EMPTY_STATS);
}

/** 세션 결과를 누적 통계에 반영한다 (localStorage). */
export function recordSession(result: SessionResult): void {
  const prev = getStats();

  const next: UserStats = {
    totalSessions: prev.totalSessions + 1,
    totalAnswered: prev.totalAnswered + result.total,
    totalCorrect: prev.totalCorrect + result.correctCount,
  };

  setItem(STATS_KEY, next);
}
