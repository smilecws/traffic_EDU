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

/* ------------------------------------------------------------------ *
 * 회차 코드 발급 (관리자 측)
 *
 * 손으로 코드를 타이핑하면 세 가지가 터진다 —
 *  1) 충돌: 같은 날 서울·춘천이 둘 다 `1124a`를 쳐서 통계가 섞인다
 *  2) 오타: `1124-soeul`은 에러 없이 "다른 회차"가 되어 통계가 조용히 쪼개진다
 *  3) 오염: 날짜 기반 코드는 추측 가능 → 제3자가 `?g=1124a`로 응답을 쌓을 수 있다
 * 지점 슬러그 + 랜덤 접미사를 앱이 만들어 주면 세 개가 동시에 막힌다.
 * ------------------------------------------------------------------ */

/** 지점 슬러그 최대 길이 — `MMDD-<slug>-<rand3>` 전체가 24자를 넘지 않도록. */
const BRANCH_MAX_LENGTH = 24 - "1124-".length - "-abc".length; // 15

/** 랜덤 접미사 길이. */
const SUFFIX_LENGTH = 3;

/**
 * 혼동하기 쉬운 글자(0·o·1·l·i)를 뺀 알파벳.
 * 코드를 눈으로 받아적거나 구두로 전달할 때의 오류를 줄인다.
 */
const SUFFIX_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/**
 * 지점명 한글 → 코드용 슬러그.
 * 코드 형식이 `[a-z0-9-]`뿐이라 한글을 담을 수 없으므로, 강사가 한글로 입력해도
 * 코드가 만들어지도록 자주 쓰는 지역명을 미리 매핑해 둔다.
 */
const BRANCH_SLUGS: Record<string, string> = {
  서울: "seoul",
  춘천: "chuncheon",
  원주: "wonju",
  강릉: "gangneung",
  부산: "busan",
  대구: "daegu",
  인천: "incheon",
  광주: "gwangju",
  대전: "daejeon",
  울산: "ulsan",
  세종: "sejong",
  수원: "suwon",
  성남: "seongnam",
  용인: "yongin",
  고양: "goyang",
  의정부: "uijeongbu",
  청주: "cheongju",
  천안: "cheonan",
  전주: "jeonju",
  포항: "pohang",
  창원: "changwon",
  제주: "jeju",
};

/**
 * 지점 입력값을 코드에 넣을 슬러그로 바꾼다. 비울 수 없으면 null.
 *
 * - 한글 지역명은 표에서 찾아 로마자로 바꾼다(`서울교육장` → `seoul`).
 * - 그 밖의 입력은 소문자화 후 `[a-z0-9-]`만 남긴다(`Seoul 2반` → `seoul-2`).
 */
export function normalizeBranchSlug(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 한글 지역명 — 정확히 일치하거나 입력에 포함돼 있으면 그 슬러그를 쓴다.
  const direct = BRANCH_SLUGS[trimmed];
  if (direct) return direct;
  for (const [korean, slug] of Object.entries(BRANCH_SLUGS)) {
    if (trimmed.includes(korean)) return slug;
  }

  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, BRANCH_MAX_LENGTH)
    .replace(/-+$/g, "");

  return slug.length > 0 ? slug : null;
}

/** 알아보기 쉬운 알파벳에서 랜덤 접미사를 만든다. */
function randomSuffix(length: number = SUFFIX_LENGTH): string {
  const bytes = new Uint8Array(length);
  // 브라우저/Node 모두 전역 crypto를 제공한다(Node 19+).
  crypto.getRandomValues(bytes);
  return [...bytes]
    .map((b) => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length])
    .join("");
}

/** Date → `MMDD` (관리자 기기의 로컬 날짜 = 교육이 열리는 날). */
function toMonthDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/**
 * 새 회차 코드를 발급한다 — `MMDD-<지점>-<랜덤3>` (예: `1124-chuncheon-7k2`).
 * 지점을 슬러그로 바꿀 수 없으면 null.
 */
export function issueGroupCode(
  branch: string,
  now: Date = new Date(),
): string | null {
  const slug = normalizeBranchSlug(branch);
  if (!slug) return null;
  return normalizeGroupCode(`${toMonthDay(now)}-${slug}-${randomSuffix()}`);
}

/* ------------------------------------------------------------------ *
 * 관리자 기기에 남기는 발급 내역
 *
 * 달력 조회는 "응답이 1건이라도 쌓인 뒤"에만 코드를 보여준다. 발급 직후~첫 응답
 * 사이에 관리자가 새로고침하면 코드를 잃고 QR이 죽으므로, 발급 시점에 로컬에도
 * 적어 둔다. 서버 기록이 아니라 그 기기의 메모다.
 * ------------------------------------------------------------------ */

/** 발급 내역 localStorage 키. */
const ISSUED_KEY = "quiz:adminIssuedCodes";

/** 마지막 지점 입력값 localStorage 키. */
const BRANCH_KEY = "quiz:adminBranch";

/** 보관할 발급 내역 개수. */
const ISSUED_LIMIT = 20;

/** 발급 내역 1건. */
export interface IssuedGroupCode {
  code: string;
  /** 발급 시 입력한 지점(표시용 — 한글일 수 있다). */
  branch: string;
  /** epoch ms */
  issuedAt: number;
}

/** 발급 내역을 최신순으로 읽는다. */
export function getIssuedCodes(): IssuedGroupCode[] {
  const list = getItem<IssuedGroupCode[]>(ISSUED_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter(
    (e): e is IssuedGroupCode =>
      !!e && typeof e.code === "string" && typeof e.issuedAt === "number",
  );
}

/** 발급 내역에 1건 추가한다(같은 코드는 중복 저장하지 않는다). */
export function saveIssuedCode(entry: IssuedGroupCode): void {
  const next = [
    entry,
    ...getIssuedCodes().filter((e) => e.code !== entry.code),
  ].slice(0, ISSUED_LIMIT);
  setItem(ISSUED_KEY, next);
  issuedSnapshot = next;
  for (const listener of issuedListeners) listener();
}

/** 마지막으로 입력한 지점(발급 화면 기본값). */
export function getAdminBranch(): string {
  const value = getItem<string>(BRANCH_KEY, "");
  return typeof value === "string" ? value : "";
}

/** 지점 입력값을 기억한다. */
export function saveAdminBranch(branch: string): void {
  setItem(BRANCH_KEY, branch.trim());
}

/* ------------------------------------------------------------------ *
 * 발급 내역 구독 (useSyncExternalStore)
 *
 * 렌더 중 localStorage를 읽으면 SSR 결과와 어긋나고, effect에서 setState로
 * 옮겨 담으면 불필요한 연쇄 렌더가 된다. 외부 저장소로 취급해 구독한다.
 * ------------------------------------------------------------------ */

/** SSR 스냅샷 — 매번 같은 참조여야 한다. */
const EMPTY_ISSUED: readonly IssuedGroupCode[] = Object.freeze([]);

/** 클라이언트 스냅샷 캐시. null이면 다음 조회 때 다시 읽는다. */
let issuedSnapshot: IssuedGroupCode[] | null = null;

const issuedListeners = new Set<() => void>();

/** 발급 내역 변경을 구독한다. */
export function subscribeIssuedCodes(onChange: () => void): () => void {
  issuedListeners.add(onChange);
  return () => {
    issuedListeners.delete(onChange);
  };
}

/** 현재 발급 내역 — 변경 전까지 같은 배열 참조를 돌려준다. */
export function getIssuedCodesSnapshot(): readonly IssuedGroupCode[] {
  issuedSnapshot ??= getIssuedCodes();
  return issuedSnapshot;
}

/** SSR·초기 렌더용 빈 스냅샷. */
export function getIssuedCodesServerSnapshot(): readonly IssuedGroupCode[] {
  return EMPTY_ISSUED;
}
