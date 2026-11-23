import { getItem, setItem, removeItem } from "@/lib/utils/storage";

/**
 * 교육 회차(그룹) 코드 관리 — 익명 집계를 "이번 교육 회차"로 좁히기 위한 꼬리표.
 *
 * - 개인 식별 정보가 아니다. "누가"가 아니라 "어느 회차"만 기록한다.
 * - 교육장에서 QR/링크(`?g=1124a`)로 배포 → 앱이 저장 → 이후 세션 로그에 `g`로 동봉.
 * - 기본 유효기간은 **당일 자정까지**. 교육이 끝난 뒤 집에서 푼 기록이
 *   그 회차 통계에 섞이지 않게 한다.
 */

/** localStorage 키. */
const STORAGE_KEY = "quiz:groupCode";

/** 허용 형식 — 소문자/숫자/하이픈 1~24자. 보안 규칙의 검증식과 동일하게 유지할 것. */
const CODE_PATTERN = /^[a-z0-9-]{1,24}$/;

/** URL 쿼리 파라미터 이름. */
const QUERY_KEY = "g";

/** 저장 형태. */
interface GroupCodeEntry {
  code: string;
  /** epoch ms — 이 시각 이후로는 무효. */
  expiresAt: number;
}

/**
 * 입력값을 정규화한다(trim + 소문자). 형식에 맞지 않으면 null.
 * 코드는 사람이 손으로 입력할 수도 있으므로 대소문자를 흡수한다.
 */
export function normalizeGroupCode(raw: string): string | null {
  const code = raw.trim().toLowerCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** 오늘 자정(= 내일 00:00) 직전 시각을 epoch ms로. 기본 만료 시각. */
export function endOfToday(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** 회차 코드를 저장한다. expiresAt 미지정 시 당일 자정까지. */
export function saveGroupCode(code: string, expiresAt?: number): void {
  const normalized = normalizeGroupCode(code);
  if (!normalized) return;
  setItem<GroupCodeEntry>(STORAGE_KEY, {
    code: normalized,
    expiresAt: expiresAt ?? endOfToday(),
  });
}

/** 저장된 회차 코드. 없거나 만료됐으면 null(만료분은 정리한다). */
export function getGroupCode(): string | null {
  const entry = getItem<GroupCodeEntry | null>(STORAGE_KEY, null);
  if (!entry || typeof entry.code !== "string") return null;
  if (typeof entry.expiresAt !== "number" || Date.now() > entry.expiresAt) {
    removeItem(STORAGE_KEY);
    return null;
  }
  return normalizeGroupCode(entry.code);
}

/** 회차 코드를 지운다(교육 종료 후 수동 해제용). */
export function clearGroupCode(): void {
  removeItem(STORAGE_KEY);
}

/**
 * URL 쿼리스트링(`?g=...`)에서 회차 코드를 읽어 저장한다.
 * 저장했으면 코드를, 없거나 형식이 틀리면 null을 반환한다.
 * @param search `window.location.search` 형태의 문자열
 */
export function captureGroupCodeFromSearch(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get(QUERY_KEY);
    if (!raw) return null;
    const code = normalizeGroupCode(raw);
    if (!code) return null;
    saveGroupCode(code);
    return code;
  } catch {
    return null;
  }
}

/** 교육생에게 배포할 공유 링크를 만든다. */
export function buildGroupLink(origin: string, code: string): string {
  const normalized = normalizeGroupCode(code);
  if (!normalized) return origin;
  return `${origin.replace(/\/$/, "")}/?${QUERY_KEY}=${normalized}`;
}
