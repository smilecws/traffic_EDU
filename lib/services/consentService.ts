import { getItem, setItem, removeItem } from "@/lib/utils/storage";

/** 이름 수집 동의 기록 (localStorage 전용). */
export interface ConsentRecord {
  name: string;
  grantedAt: number;
  version: number;
}

/** 고지/수집항목이 바뀌면 +1 → 기존 동의는 무효화되어 재동의를 유도한다. */
export const CONSENT_VERSION = 1;

const CONSENT_KEY = "quiz:consent";

/**
 * 저장된 동의 기록을 반환한다.
 * - 없거나 `version`이 현재 `CONSENT_VERSION`과 다르면 null(재동의 유도).
 * - localStorage 접근은 storage.ts 래퍼만 사용(SSR-safe).
 */
export function getConsent(): ConsentRecord | null {
  const record = getItem<ConsentRecord | null>(CONSENT_KEY, null);
  if (!record || record.version !== CONSENT_VERSION) return null;
  return record;
}

/** 동의 기록을 저장한다. */
export function saveConsent(record: ConsentRecord): void {
  setItem(CONSENT_KEY, record);
}

/** 동의 기록을 제거한다(동의 철회). */
export function clearConsent(): void {
  removeItem(CONSENT_KEY);
}
