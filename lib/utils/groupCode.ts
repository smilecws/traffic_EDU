/**
 * 교육 회차 코드의 순수 로직 — 형식 검증, 코드 생성, 이름 정리, 공유 링크.
 *
 * localStorage도 Firestore도 건드리지 않는다. **서버 라우트와 브라우저가 같은
 * 규칙을 써야 하기 때문에** 별도 모듈로 분리했다. 회차 발급은 서버에서
 * 일어나고(`/api/admin/sessions`), 브라우저는 같은 함수로 형식만 확인한다.
 *
 * 규칙이 세 곳(여기·`firestore.rules`·서버 라우트)에서 어긋나면 "발급은 됐는데
 * 저장이 안 되는" 조용한 실패가 난다. 형식 상수는 반드시 여기서만 정의한다.
 *
 * **코드에는 이름이 들어가지 않는다.** 예전에는 교육반 이름을 로마자로 바꿔
 * 코드에 심었는데, 그러려면 한글 → 로마자 표를 들고 있어야 했고 표에 없는
 * 이름은 발급 자체가 막혔다. 이름을 적을 곳(회차 등록부)이 생긴 뒤로는 그럴
 * 이유가 없다 — 코드는 식별자, 이름은 표시용으로 완전히 갈라 둔다.
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
 * 코드 생성
 * ------------------------------------------------------------------ */

/**
 * 랜덤 접미사 길이.
 *
 * 코드를 아는 사람은 그 회차에 응답을 보탤 수 있으므로, 날짜를 알면 찍어 볼 수
 * 있을 만큼 짧으면 안 된다. 6자면 31^6 ≈ 8.9억 가지라 하루치를 훑는 것이
 * 의미가 없어지고, `1124-7k2m9p` 정도는 불러 주거나 받아적기에도 부담 없다.
 */
const SUFFIX_LENGTH = 6;

/**
 * 혼동하기 쉬운 글자(0·o·1·l·i)를 뺀 알파벳.
 * 코드를 눈으로 받아적거나 구두로 전달할 때의 오류를 줄인다.
 */
const SUFFIX_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

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
 * 서버 로컬시간을 쓰면 안 된다. 발급은 Vercel(UTC)에서 일어나는데, KST
 * 00:00~09:00에 발급하면 UTC로는 아직 전날이라 코드에 하루 전 날짜가 박힌다.
 * 교육이 열리는 날과 코드가 어긋나면 달력에서 찾을 수 없다.
 */
function toMonthDay(d: Date): string {
  return toKstDateString(d.getTime()).slice(5).replace("-", "");
}

/**
 * 새 회차 코드를 만든다 — `MMDD-<랜덤6>` (예: `1124-7k2m9p`).
 *
 * 날짜를 앞에 두는 것은 관리자가 코드만 보고 언제 것인지 알게 하기 위해서다.
 * 접미사가 겹칠 확률은 매우 낮지만 0은 아니고, 겹치면 두 회차의 통계가 한
 * 코드로 합쳐진다. 서버가 등록 전에 같은 코드가 있는지 확인하고 다시 뽑는다
 * (`issueSession`).
 */
export function issueGroupCode(now: Date = new Date()): string {
  return `${toMonthDay(now)}-${randomSuffix()}`;
}

/* ------------------------------------------------------------------ *
 * 교육반·교수자 이름
 * ------------------------------------------------------------------ */

/** 이름 최대 길이 — 목록에서 한 줄에 들어오는 선을 넘지 않게. */
export const BRANCH_MAX_LENGTH = 40;

/**
 * 교육반·교수자 이름을 저장 가능한 형태로 다듬는다.
 *
 * **비어 있어도 된다.** 이름은 관리자가 나중에 목록에서 알아보기 위한 메모일
 * 뿐이고, 회차를 식별하는 것은 코드다. 비우면 빈 문자열이 되고 발급은 그대로
 * 진행된다.
 *
 * 글자 자체에는 제한을 두지 않는다 — 한글·영문·숫자 무엇이든 적을 수 있다.
 * 제어문자를 지우고 공백을 접은 뒤 길이만 자른다.
 */
export function normalizeBranchName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BRANCH_MAX_LENGTH);
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
