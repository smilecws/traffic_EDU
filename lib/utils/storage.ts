/**
 * SSR-safe localStorage 래퍼.
 * - 브라우저 전용 API이므로 `typeof window` 가드로 SSR에서 fallback을 반환한다.
 * - 값은 JSON으로 직렬화/역직렬화한다.
 */

/** key의 값을 읽어 역직렬화한다. 없거나 파싱 실패/SSR이면 fallback 반환. */
export function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** value를 직렬화해 저장한다. SSR/실패 시 무시. */
export function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패(쿼터 초과 등)는 무시 — 개인 데이터는 best-effort
  }
}

/** key를 제거한다. SSR/실패 시 무시. */
export function removeItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 무시
  }
}
