import type { QuestionResult, SessionMeta, SessionResult } from "@/lib/types";
import { getItem, setItem } from "@/lib/utils/storage";

const RECENT_RESULTS_KEY = "quiz:recentResults";
const SAVED_IDS_KEY = "quiz:savedSessionIds";

/** 최근 저장 세션 id 보관 개수 (멱등성 가드용, 무한 증가 방지). */
const MAX_SAVED_IDS = 50;

/** 최근 세션 상세 보관 개수 상한 (localStorage 무한 증가 방지). */
const MAX_RECENT_RESULTS = 50;

/** 결과 페이지 표시용 세션 상세 — 집계(SessionResult) + 문제별 결과. */
export interface SessionResultDetail {
  result: SessionResult;
  results: QuestionResult[];
  meta?: SessionMeta;
}

/**
 * 끝난 세션 결과를 저장한다 (결과/이력 페이지 표시용, localStorage).
 * SessionResult에는 문제별 상세가 없으므로 results도 함께 보관한다.
 * 모의고사 이력에서 과거 응시를 /result/[id]로 재열람할 수 있도록
 * 최근 상세를 배열(최신 우선, 상한 50)로 누적한다.
 */
export function saveSessionResult(detail: SessionResultDetail): void {
  const recent = getItem<SessionResultDetail[]>(RECENT_RESULTS_KEY, []);
  // 같은 id가 있으면 제거 후(중복 추가 금지) 최신을 앞에 prepend.
  const deduped = recent.filter((d) => d.result.id !== detail.result.id);
  const next = [detail, ...deduped].slice(0, MAX_RECENT_RESULTS);
  setItem(RECENT_RESULTS_KEY, next);
}

/** 저장된 세션 결과를 id로 조회한다. 없으면 null. */
export function getSessionResult(id: string): SessionResultDetail | null {
  const recent = getItem<SessionResultDetail[]>(RECENT_RESULTS_KEY, []);
  return recent.find((d) => d.result.id === id) ?? null;
}

/** 해당 세션이 이미 통계/오답노트/집계에 반영되었는지 (멱등성 가드). */
export function isSessionSaved(id: string): boolean {
  return getItem<string[]>(SAVED_IDS_KEY, []).includes(id);
}

/** 세션을 저장 완료로 표시한다 (새로고침 등 중복 저장 방지). */
export function markSessionSaved(id: string): void {
  const ids = getItem<string[]>(SAVED_IDS_KEY, []);
  if (ids.includes(id)) return;
  ids.push(id);
  setItem(SAVED_IDS_KEY, ids.slice(-MAX_SAVED_IDS));
}
