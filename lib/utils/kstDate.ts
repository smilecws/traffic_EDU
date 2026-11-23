/**
 * KST(UTC+9) 날짜 경계 계산.
 *
 * 서버(Vercel)는 UTC로 돌기 때문에 서버 로컬시간을 쓰면 하루가 9시간 밀린다.
 * 교육은 국내에서만 진행되므로 KST로 못박는다. 집계 라우트들이 공유한다.
 */

/** KST 오프셋(ms). */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** `yyyy-MM-dd` 형식 검사식. */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `yyyy-MM` 형식 검사식. */
export const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/**
 * `yyyy-MM-dd` → 그 날의 KST 하루 경계(Date).
 * - 시작: KST 00:00:00.000 = UTC 전날 15:00 → `Date.UTC`의 시(hour)를 -9로 표현
 * - 종료: KST 23:59:59.999 = UTC 같은 날 14:59:59.999
 */
export function kstDayBoundary(value: string, boundary: "start" | "end"): Date {
  const [y, m, d] = value.split("-").map(Number);
  return boundary === "start"
    ? new Date(Date.UTC(y, m - 1, d, -9, 0, 0, 0))
    : new Date(Date.UTC(y, m - 1, d, 14, 59, 59, 999));
}

/**
 * `yyyy-MM` → 그 달의 KST 경계(Date).
 * 종료 경계는 `Date.UTC(y, m, 0, ...)`로 "다음 달 0일" = 그 달 마지막 날을 얻는다.
 */
export function kstMonthBoundary(
  value: string,
  boundary: "start" | "end",
): Date {
  const [y, m] = value.split("-").map(Number);
  return boundary === "start"
    ? new Date(Date.UTC(y, m - 1, 1, -9, 0, 0, 0))
    : new Date(Date.UTC(y, m, 0, 14, 59, 59, 999));
}

/**
 * epoch ms → 그 시각이 속한 **KST 달력 날짜** (`yyyy-MM-dd`).
 * UTC로 9시간을 밀어 놓고 UTC 날짜를 읽는 방식 — 서버 TZ와 무관하게 같은 답을 준다.
 */
export function toKstDateString(epochMs: number): string {
  return new Date(epochMs + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** epoch ms → 그 시각이 속한 KST 달(`yyyy-MM`). */
export function toKstMonthString(epochMs: number): string {
  return toKstDateString(epochMs).slice(0, 7);
}

/** `yyyy-MM`에서 offset개월 이동한 달을 돌려준다(`-1` = 이전 달). */
export function shiftMonth(value: string, offset: number): string {
  const [y, m] = value.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 그 달의 일수. */
export function daysInMonth(value: string): number {
  const [y, m] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 그 달 1일의 요일(0=일 … 6=토). */
export function firstWeekdayOfMonth(value: string): number {
  const [y, m] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}
