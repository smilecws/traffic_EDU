import { getItem, setItem } from "@/lib/utils/storage";

const MOCK_HISTORY_KEY = "quiz:mockHistory";

/** 모의고사 이력 보관 개수 상한 (localStorage 무한 증가 방지). */
const MAX_MOCK_HISTORY = 50;

/** 모의고사 응시 1회 기록 — 개인 식별 정보 없이 면허/점수/시각만 보관. */
export interface MockHistoryEntry {
  id: string; // 세션 id (중복 저장 방지 키)
  licenseId: string;
  licenseLabel: string;
  passScore: number;
  scorePercent: number;
  correctCount: number;
  total: number;
  passed: boolean;
  finishedAt: number; // epoch ms
}

/**
 * 모의고사 응시 결과를 localStorage에 누적 저장한다.
 * - 같은 id가 이미 있으면 추가하지 않는다(멱등).
 * - 최신이 앞에 오도록 prepend, 최근 50개 상한으로 자른다.
 */
export function addMockResult(entry: MockHistoryEntry): void {
  const history = getItem<MockHistoryEntry[]>(MOCK_HISTORY_KEY, []);
  if (history.some((e) => e.id === entry.id)) return;
  const next = [entry, ...history].slice(0, MAX_MOCK_HISTORY);
  setItem(MOCK_HISTORY_KEY, next);
}

/** 저장된 모의고사 이력을 최신순(finishedAt desc)으로 반환한다. */
export function getMockHistory(): MockHistoryEntry[] {
  const history = getItem<MockHistoryEntry[]>(MOCK_HISTORY_KEY, []);
  return [...history].sort((a, b) => b.finishedAt - a.finishedAt);
}
