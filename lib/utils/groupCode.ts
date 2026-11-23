/**
 * 교육 회차 코드의 순수 로직 — 형식 검증, 교육반 슬러그, 코드 생성, 공유 링크.
 *
 * localStorage도 Firestore도 건드리지 않는다. **서버 라우트와 브라우저가 같은
 * 규칙을 써야 하기 때문에** 별도 모듈로 분리했다. 회차 발급은 이제 서버에서
 * 일어나고(`/api/admin/sessions`), 브라우저는 같은 함수로 형식만 확인한다.
 *
 * 규칙이 세 곳(여기·`firestore.rules`·서버 라우트)에서 어긋나면 "발급은 됐는데
 * 저장이 안 되는" 조용한 실패가 난다. 형식 상수는 반드시 여기서만 정의한다.
 */

import { toKstDateString } from "@/lib/utils/kstDate";

/** 허용 형식 — 소문자/숫자/하이픈 1~24자. 보안 규칙의 검증식과 동일하게 유지할 것. */
export const CODE_PATTERN = /^[a-z0-9-]{1,24}$/;

/** URL 쿼리 파라미터 이름. */
export const QUERY_KEY = "g";

/**
 * 입력값을 정규화한다(trim + 소문자). 형식에 맞지 않으면 null.
 * 코드는 사람이 손으로 입력할 수도 있으므로 대소문자를 흡수한다.
 */
export function normalizeGroupCode(raw: string): string | null {
  const code = raw.trim().toLowerCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/* ------------------------------------------------------------------ *
 * 교육반 슬러그
 * ------------------------------------------------------------------ */

/** 교육반 슬러그 최대 길이 — `MMDD-<slug>-<rand3>` 전체가 24자를 넘지 않도록. */
export const BRANCH_MAX_LENGTH = 24 - "1124-".length - "-abc".length; // 15

/** 랜덤 접미사 길이. */
const SUFFIX_LENGTH = 3;

/**
 * 혼동하기 쉬운 글자(0·o·1·l·i)를 뺀 알파벳.
 * 코드를 눈으로 받아적거나 구두로 전달할 때의 오류를 줄인다.
 */
const SUFFIX_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/**
 * 교육반·지점명 한글 → 코드용 슬러그.
 * 코드 형식이 `[a-z0-9-]`뿐이라 한글을 담을 수 없으므로, 자주 쓰는 이름을 미리
 * 매핑해 둔다. 표에 없는 한글은 슬러그가 비어 발급이 거부되므로, 새 교육반이
 * 생기면 여기에 한 줄 추가한다.
 */
const BRANCH_SLUGS: Record<string, string> = {
  // 교육반
  음주: "eumju",
  교수자: "gyosuja",

  // 지점
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
 * 교육반 입력값을 코드에 넣을 슬러그로 바꾼다. 비울 수 없으면 null.
 *
 * - 한글 이름은 표에서 찾아 로마자로 바꾼다(`서울교육장` → `seoul`).
 * - 그 밖의 입력은 소문자화 후 `[a-z0-9-]`만 남긴다(`Seoul 2반` → `seoul-2`).
 */
export function normalizeBranchSlug(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 한글 이름 — 정확히 일치하거나 입력에 포함돼 있으면 그 슬러그를 쓴다.
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

/* ------------------------------------------------------------------ *
 * 코드 생성
 * ------------------------------------------------------------------ */

/** 알아보기 쉬운 알파벳에서 랜덤 접미사를 만든다. */
function randomSuffix(length: number = SUFFIX_LENGTH): string {
  const bytes = new Uint8Array(length);
  // 브라우저/Node 모두 전역 crypto를 제공한다(Node 19+).
  crypto.getRandomValues(bytes);
  return [...bytes]
    .map((b) => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length])
    .join("");
}

/**
 * Date → **KST 기준** `MMDD`.
 *
 * 서버 로컬시간을 쓰면 안 된다. 발급은 이제 Vercel(UTC)에서 일어나는데,
 * KST 00:00~09:00에 발급하면 UTC로는 아직 전날이라 코드에 하루 전 날짜가
 * 박힌다. 교육이 열리는 날과 코드가 어긋나면 달력에서 찾을 수 없다.
 */
function toMonthDay(d: Date): string {
  return toKstDateString(d.getTime()).slice(5).replace("-", "");
}

/**
 * 새 회차 코드를 만든다 — `MMDD-<교육반>-<랜덤3>` (예: `1124-eumju-7k2`).
 * 교육반을 슬러그로 바꿀 수 없으면 null.
 *
 * 접미사가 랜덤이라 충돌 확률은 낮지만 0은 아니다. 서버가 등록 전에 같은
 * 코드가 있는지 확인하고 다시 뽑는다(`issueSession`).
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
 * 공유 링크
 * ------------------------------------------------------------------ */

/**
 * 교육생에게 배포할 공유 링크를 만든다.
 *
 * 설문 여부는 **링크가 아니라 서버의 회차 기록이 정한다.** 예전에는 `&s=1`이
 * 그 역할을 했는데, 교육생이 주소창에 직접 붙여도 설문이 열리는 구멍이었다.
 * 지금은 기기가 `/api/session`에 물어보고, 서버가 "이 회차는 설문을 받는다"고
 * 답할 때만 열린다. 링크에 `&s=1`을 남겨 두는 것은 이미 인쇄되어 나간 QR과
 * 모양을 맞추기 위해서이며, 켜고 끄는 힘은 없다.
 */
export function buildGroupLink(
  origin: string,
  code: string,
  options: { survey?: boolean } = {},
): string {
  const normalized = normalizeGroupCode(code);
  if (!normalized) return origin;
  const base = `${origin.replace(/\/$/, "")}/?${QUERY_KEY}=${normalized}`;
  return options.survey ? `${base}&s=1` : base;
}
