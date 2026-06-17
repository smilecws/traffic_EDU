import type { QuestionResult, SessionResult } from "@/lib/types";

/**
 * 복수 정답 채점 — 고른 선택지 집합이 정답 집합과 **완전히 일치**할 때만 정답.
 * 순서·중복은 무시한다.
 */
export function isAnswerCorrect(
  selectedIds: number[],
  answerIds: number[],
): boolean {
  if (selectedIds.length !== answerIds.length) return false;
  const answers = new Set(answerIds);
  return selectedIds.every((id) => answers.has(id));
}

/**
 * 세션을 채점한다. 각 결과의 correct는 채점 시점(answer)에 이미 확정돼 있으므로
 * 여기서는 집계만 한다.
 * 결정적(deterministic) 함수 — Math.random()/Date.now()를 사용하지 않는다.
 *
 * @param results 각 문제의 채점 결과
 * @param opts.id 세션/결과 식별자 (기본값 "")
 * @param opts.finishedAt 완료 시각 — 호출측에서 주입 (기본값 0)
 */
export function gradeSession(
  results: QuestionResult[],
  opts: { id?: string; finishedAt?: number } = {},
): SessionResult {
  const { id = "", finishedAt = 0 } = opts;

  let correctCount = 0;
  for (const r of results) {
    if (r.correct) correctCount++;
  }

  const total = results.length;
  const scorePercent = total === 0 ? 0 : Math.round((correctCount / total) * 100);

  return {
    id,
    total,
    correctCount,
    scorePercent,
    finishedAt,
  };
}
