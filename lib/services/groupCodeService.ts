import { getItem, setItem, removeItem } from "@/lib/utils/storage";
import { QUERY_KEY, normalizeGroupCode } from "@/lib/utils/groupCode";

/**
 * 교육 회차(그룹) 코드 관리 — 익명 집계를 "이번 교육 회차"로 좁히기 위한 꼬리표.
 *
 * - 개인 식별 정보가 아니다. "누가"가 아니라 "어느 회차"만 기록한다.
 * - 교육장에서 QR/링크(`?g=1124-eumju-7k2`)로 배포 → 앱이 저장 → 이후 세션
 *   로그에 `g`로 동봉.
 * - 기본 유효기간은 **당일 자정까지**. 교육이 끝난 뒤 집에서 푼 기록이
 *   그 회차 통계에 섞이지 않게 한다.
 *
 * 코드의 형식·생성 규칙은 `lib/utils/groupCode.ts`에 있다(서버와 공유). 이
 * 모듈은 **기기에 저장하는 일**만 맡는다.
 */

export {
  CODE_PATTERN,
  QUERY_KEY,
  BRANCH_MAX_LENGTH,
  buildGroupLink,
  issueGroupCode,
  normalizeBranchSlug,
  normalizeGroupCode,
} from "@/lib/utils/groupCode";

/** localStorage 키. */
const STORAGE_KEY = "quiz:groupCode";

/** 저장 형태. */
interface GroupCodeEntry {
  code: string;
  /** epoch ms — 이 시각 이후로는 무효. */
  expiresAt: number;
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
 *
 * 여기서는 **형식만** 본다. 발급된 회차인지는 서버만 알고 있고, 그 확인은
 * `GroupCodeCapture`가 `/api/session`에 따로 물어본다. 형식만 맞으면 일단
 * 저장하는 이유는, 네트워크가 느린 교육장에서 확인을 기다리다 코드를 놓치면
 * 그 교육생의 응답이 통째로 회차에서 빠지기 때문이다.
 *
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

/* ------------------------------------------------------------------ *
 * 관리자 화면이 기억하는 입력값
 *
 * 발급 내역 자체는 더 이상 기기에 두지 않는다 — 서버의 `sessions` 컬렉션이
 * 원본이고, 관리자 화면은 `/api/admin/sessions`로 읽는다. 기기가 바뀌어도
 * 회차가 사라지지 않는다. 여기 남은 것은 "다음에도 같은 값으로 시작하기"
 * 수준의 편의 기억뿐이다.
 * ------------------------------------------------------------------ */

/** 마지막 교육반 입력값 localStorage 키. */
const BRANCH_KEY = "quiz:adminBranch";

/** 만족도 조사 체크 상태 localStorage 키(발급 화면 기본값). */
const SURVEY_FLAG_KEY = "quiz:adminSurvey";

/** 마지막으로 입력한 교육반(발급 화면 기본값). */
export function getAdminBranch(): string {
  const value = getItem<string>(BRANCH_KEY, "");
  return typeof value === "string" ? value : "";
}

/** 교육반 입력값을 기억한다. */
export function saveAdminBranch(branch: string): void {
  setItem(BRANCH_KEY, branch.trim());
}

/** 만족도 조사 체크 상태(발급 화면 기본값). 같은 강사는 보통 매번 같게 쓴다. */
export function getAdminSurveyFlag(): boolean {
  return getItem<boolean>(SURVEY_FLAG_KEY, false) === true;
}

/** 만족도 조사 체크 상태를 기억한다. */
export function saveAdminSurveyFlag(enabled: boolean): void {
  setItem(SURVEY_FLAG_KEY, enabled);
}
