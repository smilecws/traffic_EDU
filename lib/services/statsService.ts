import type { UserStats } from "@/lib/types";
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

/**
 * 한 문제 채점 결과를 누적 통계에 즉시 반영한다 (문제당 호출).
 * 세션 완료를 기다리지 않으므로 중간에 그만둬도 푼 만큼 집계된다.
 */
export function recordAnswer(correct: boolean): void {
  const prev = getStats();
  setItem(STATS_KEY, {
    ...prev,
    totalAnswered: prev.totalAnswered + 1,
    totalCorrect: prev.totalCorrect + (correct ? 1 : 0),
  });
}

/**
 * 세션 완료 횟수만 +1 한다 (문제별 정답/오답 집계는 recordAnswer가 담당).
 * 결과 화면에서 세션당 1회 호출(멱등 가드는 호출측 책임).
 */
export function recordSessionComplete(): void {
  const prev = getStats();
  setItem(STATS_KEY, { ...prev, totalSessions: prev.totalSessions + 1 });
}
