import type { GlobalAggregate } from "@/lib/types";
import { getItem, setItem } from "@/lib/utils/storage";

/** 집계 캐시 localStorage 키 (body + fetchedAt). */
const CACHE_KEY = "quiz:globalAggregate";

/** 캐시 신선도 기준 — 1시간. */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** localStorage에 보관하는 캐시 형태. */
interface CacheEntry {
  body: GlobalAggregate;
  fetchedAt: number; // epoch ms
}

/** 응답이 GlobalAggregate 형태인지 최소 검증 (top이 배열이어야 함). */
function isValidAggregate(value: unknown): value is GlobalAggregate {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as GlobalAggregate).top)
  );
}

/**
 * 전체 사용자 오답 집계(aggregates.json)를 로드한다.
 *
 * - URL은 `NEXT_PUBLIC_AGGREGATE_URL`. 미설정이면 즉시 `null`(파이프라인 미구성 — 앱은 정상 동작).
 * - 캐시 전략(Flutter 패턴 이식):
 *   1. localStorage 캐시가 1시간 이내면 그대로 반환.
 *   2. 아니면 fetch → 200이면 파싱·캐시 저장 후 반환.
 *   3. fetch 실패 시 만료된 캐시라도 폴백, 그것도 없으면 `null`.
 * - 클라이언트는 Firestore를 직접 읽지 않는다(정적 JSON fetch만).
 */
export async function loadGlobalAggregate(): Promise<GlobalAggregate | null> {
  const url = process.env.NEXT_PUBLIC_AGGREGATE_URL;
  if (!url) return null;

  const cached = getItem<CacheEntry | null>(CACHE_KEY, null);

  // 1. 신선한 캐시면 그대로 반환.
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    if (isValidAggregate(cached.body)) return cached.body;
  }

  // 2. fetch 시도.
  try {
    const res = await fetch(url);
    if (res.ok) {
      const body: unknown = await res.json();
      if (!isValidAggregate(body)) return null;
      setItem<CacheEntry>(CACHE_KEY, { body, fetchedAt: Date.now() });
      return body;
    }
  } catch {
    // 네트워크 실패 — 폴백으로 진행.
  }

  // 3. 만료된 캐시라도 폴백, 없으면 null.
  if (cached && isValidAggregate(cached.body)) return cached.body;
  return null;
}
