import { getItem, setItem } from "@/lib/utils/storage";
import { getWrongNotes } from "@/lib/services/wrongNoteService";

/**
 * 한 번이라도 답한 문제 id 목록 (localStorage).
 *
 * 누적 통계(`quiz:stats`)는 맞힌/틀린 **개수**만 세서, 어떤 문제를 풀었는지 알 수
 * 없었다. "안 푼 문제부터 출제"를 하려면 문제별 기록이 따로 필요하다.
 * 개수가 아니라 집합이므로 같은 문제를 여러 번 풀어도 한 번만 남는다.
 *
 * 개인 기기에만 저장한다(서버로 보내지 않는다).
 */
const SOLVED_KEY = "quiz:solved";

/**
 * 이 기록은 기능과 함께 생겼다. 그 전에 푼 문제는 남아 있지 않지만 **오답노트에
 * 있는 문제는 분명히 푼 문제**이므로, 처음 한 번만 옮겨 담는다. 매번 합치지 않고
 * 한 번만 옮기는 이유는 "기록 초기화" 뒤에도 그 문제들이 계속 빠지지 않게 하기
 * 위해서다. 이 표시는 초기화해도 지우지 않는다.
 */
const SEEDED_KEY = "quiz:solved:seeded";

function readIds(): string[] {
  const raw = getItem<unknown>(SOLVED_KEY, []);
  return Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string")
    : [];
}

/** 푼 문제 id 목록. */
export function getSolvedIds(): string[] {
  if (!getItem<boolean>(SEEDED_KEY, false)) {
    const merged = [
      ...new Set([...readIds(), ...getWrongNotes().map((n) => n.questionId)]),
    ];
    setItem(SOLVED_KEY, merged);
    setItem(SEEDED_KEY, true);
    return merged;
  }
  return readIds();
}

/** 문제를 "푼 문제"로 표시한다. 이미 있으면 그대로 둔다. */
export function markSolved(questionId: string): void {
  const ids = getSolvedIds();
  if (ids.includes(questionId)) return;
  setItem(SOLVED_KEY, [...ids, questionId]);
}

/** 푼 문제 기록을 비운다 — 처음부터 다시 돌고 싶을 때. */
export function clearSolved(): void {
  setItem(SEEDED_KEY, true);
  setItem(SOLVED_KEY, []);
}
