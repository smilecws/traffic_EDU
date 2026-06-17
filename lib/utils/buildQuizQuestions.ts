import type { Question, QuizMode } from "@/lib/types";
import { pickRandom } from "@/lib/utils/pickRandom";

/** 한 세션에 출제할 문제 수 (문제가 적으면 가능한 만큼). */
const SESSION_SIZE = 40;

/**
 * 모드에 따라 세션 문제 목록을 구성하는 순수 함수.
 * - random | mock: 전체에서 무작위 40개(부족하면 가능한 만큼).
 *   opts.type이 주어지면 해당 유형으로 먼저 거른 뒤 무작위 추출.
 * - sequential: opts.startNumber 이상인 문제를 **번호 오름차순으로 전부**(테스트용).
 * - wrong | favorite: 지정 id에 해당하는 문제만, 지정 id의 **순서를 보존**.
 *   (최근 우선 정렬은 호출측 책임. 존재하지 않는 id는 무시.)
 * - 결과가 비어도 그대로 빈 배열 반환(빈 상태는 UI가 처리).
 *
 * 순수 함수 — Date.now()/Math.random()을 직접 호출하지 않는다.
 * 랜덤이 필요한 random/mock은 pickRandom에 위임한다.
 */
export function buildQuizQuestions(
  mode: QuizMode,
  sources: { all: Question[]; wrongIds: string[]; favoriteIds: string[] },
  opts: { type?: string; startNumber?: number } = {},
): Question[] {
  const { all, wrongIds, favoriteIds } = sources;
  const { type, startNumber } = opts;

  if (mode === "sequential") {
    const start = startNumber ?? 1;
    return [...all]
      .sort((a, b) => a.number - b.number)
      .filter((q) => q.number >= start);
  }

  if (mode === "random" || mode === "mock") {
    const pool = type ? all.filter((q) => q.type === type) : all;
    return pickRandom(pool, SESSION_SIZE);
  }

  const ids = mode === "wrong" ? wrongIds : favoriteIds;
  const byId = new Map(all.map((q) => [q.id, q]));
  // 지정 id 순서를 보존하면서 존재하는 문제만 추린다.
  return ids
    .map((id) => byId.get(id))
    .filter((q): q is Question => q !== undefined);
}
