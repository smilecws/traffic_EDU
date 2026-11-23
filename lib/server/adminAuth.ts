import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 관리자 세션 — 공유 비밀번호 1개 방식 (서버 전용).
 *
 * - 비밀번호는 **서버 환경변수 `ADMIN_PASSWORD`에만** 존재한다. 브라우저 번들에
 *   들어가지 않으므로 `NEXT_PUBLIC_` 접두사를 절대 붙이지 않는다.
 * - 로그인 성공 시 httpOnly 쿠키에 "만료시각.서명"을 담는다. 서버가 서명을
 *   검증하므로 쿠키를 위조할 수 없고, 비밀번호 자체는 쿠키에 담기지 않는다.
 * - 서명 키로 비밀번호를 그대로 쓴다 → 비밀번호를 바꾸면 기존 세션이 전부 무효화된다.
 * - 이 모듈은 서버(route handler)에서만 import한다.
 */

/** 세션 쿠키 이름. */
export const ADMIN_COOKIE = "tedu_admin";

/** 세션 유효기간 — 12시간 (교육 하루 분량). */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

/** 설정된 관리자 비밀번호. 미설정이면 null(기능 비활성). */
function getPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD;
  return value && value.length > 0 ? value : null;
}

/** 관리자 기능이 설정되어 있는지. */
export function isAdminConfigured(): boolean {
  return getPassword() !== null;
}

/** 길이 노출을 줄이기 위해 해시 후 상수시간 비교한다. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** 입력 비밀번호가 맞는지. 미설정이면 항상 false. */
export function verifyPassword(input: string): boolean {
  const password = getPassword();
  if (!password) return false;
  return safeEqual(input, password);
}

/** 만료시각(초)에 대한 서명. */
function sign(expiresAtSec: number, password: string): string {
  return createHmac("sha256", password)
    .update(String(expiresAtSec))
    .digest("hex");
}

/** 새 세션 쿠키 값을 만든다. 형식: `<만료시각(초)>.<서명>` */
export function createSessionValue(now: number = Date.now()): string | null {
  const password = getPassword();
  if (!password) return null;
  const expiresAtSec = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  return `${expiresAtSec}.${sign(expiresAtSec, password)}`;
}

/** 쿠키 값이 유효한 세션인지(서명 일치 + 미만료). */
export function verifySessionValue(
  value: string | undefined,
  now: number = Date.now(),
): boolean {
  const password = getPassword();
  if (!password || !value) return false;

  const [expiresAtRaw, signature] = value.split(".");
  if (!expiresAtRaw || !signature) return false;

  const expiresAtSec = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAtSec)) return false;
  if (Math.floor(now / 1000) >= expiresAtSec) return false;

  return safeEqual(signature, sign(expiresAtSec, password));
}
