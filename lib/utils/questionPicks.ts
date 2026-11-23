/**
 * 지정 출제 문제 목록(`picks`)의 순수 로직 — 검증·파싱·표시.
 *
 * localStorage도 Firestore도 건드리지 않는다. **서버 라우트와 브라우저가 같은
 * 규칙을 써야 하기 때문에** 별도 모듈로 분리했다(회차 코드의 `groupCode.ts`와
 * 같은 이유). 발급은 서버가 받아 적고, 관리자 화면은 같은 함수로 입력을
 * 미리 검증한다.
 *
 * picks의 원소는 **문제 id**(= `Question.id` = 문제번호의 문자열)다. 숫자가
 * 아니라 문자열로 다루는 이유는 오답노트·즐겨찾기·익명 로그가 모두 이 id를
 * 키로 쓰고 있어서, 어디서도 숫자 ↔ 문자열 변환이 끼지 않게 하기 위해서다.
 */

/**
 * 한 회차에 지정할 수 있는 문제 수 상한.
 *
 * 보안 규칙이 익명 로그 한 건의 `items`를 200개로 제한하고 있어(`firestore.rules`),
 * 그보다 넉넉히 아래에 둔다. 교육 한 타임에 100문제를 넘겨 풀릴 일도 없다.
 */
export const MAX_PICKS = 100;

/** 문제 id 형식 — 1 이상의 정수 문자열. */
const ID_PATTERN = /^[1-9][0-9]{0,5}$/;

/** 입력에서 번호를 끊는 구분자 — 쉼표·공백·줄바꿈을 모두 받는다. */
const SEPARATOR = /[\s,]+/;

/** 범위 표기 — `101-110`, `101~110` 둘 다 받는다. */
const RANGE_PATTERN = /^([1-9][0-9]{0,5})[-~]([1-9][0-9]{0,5})$/;

/** 문제 id로 쓸 수 있는 값인지. */
export function isValidPickId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

/**
 * 어떤 값이든 받아 **저장 가능한 picks**로 정리한다 — 서버가 요청 본문에
 * 쓰는 입구다.
 *
 * 순서는 보존한다(교수자가 적어 둔 출제 순서가 그대로 출제 순서가 된다).
 * 중복은 먼저 나온 것만 남기고, 형식에 맞지 않는 값은 버리고, 상한을 넘으면
 * 앞에서부터 자른다. 숫자로 들어온 값도 받아 문자열로 맞춘다.
 */
export function normalizePicks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const picks: string[] = [];
  for (const raw of value) {
    const id =
      typeof raw === "number" && Number.isInteger(raw) ? String(raw) : raw;
    if (!isValidPickId(id) || seen.has(id)) continue;
    seen.add(id);
    picks.push(id);
    if (picks.length >= MAX_PICKS) break;
  }
  return picks;
}

/** `parsePickInput`의 결과. */
export interface ParsedPicks {
  /** 인식된 문제 id — 적은 순서를 보존한다. */
  picks: string[];
  /** 해석할 수 없었던 토큰 원문(화면에 그대로 보여 준다). */
  invalid: string[];
  /** 상한(MAX_PICKS)에 걸려 뒤쪽을 버렸는지. */
  truncated: boolean;
}

/**
 * 사람이 손으로 적은 번호 목록을 파싱한다 — `12, 45, 101-110` 형태.
 *
 * 교수자가 종이에 문제 번호를 추려 온 경우가 가장 빠른 길이라 입력칸을 남겨
 * 둔다(기본은 목록에서 고르는 방식이다). 못 읽은 토큰을 **조용히 버리지 않고**
 * 돌려주는 것이 중요하다 — 20문제를 적었는데 18문제만 출제되는 실패가
 * 교육장에서야 드러나면 손쓸 수 없다.
 */
export function parsePickInput(raw: string): ParsedPicks {
  const picks: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let truncated = false;

  /** 상한을 지키며 한 건 담는다. 담지 못했으면 false. */
  const push = (id: string): boolean => {
    if (picks.length >= MAX_PICKS) {
      truncated = true;
      return false;
    }
    if (!seen.has(id)) {
      seen.add(id);
      picks.push(id);
    }
    return true;
  };

  for (const token of raw.split(SEPARATOR)) {
    if (!token) continue;

    const range = RANGE_PATTERN.exec(token);
    if (range) {
      // 거꾸로 적어도(110-101) 오름차순으로 읽는다.
      const a = Number(range[1]);
      const b = Number(range[2]);
      const [from, to] = a <= b ? [a, b] : [b, a];
      for (let n = from; n <= to; n += 1) {
        if (!push(String(n))) break;
      }
      continue;
    }

    if (ID_PATTERN.test(token)) {
      push(token);
      continue;
    }

    invalid.push(token);
  }

  return { picks, invalid, truncated };
}

/**
 * picks를 사람이 읽는 문자열로 — `1~3, 8, 12~14`.
 *
 * 번호순으로 정렬해 연속 구간을 접는다. 40문제를 지정한 회차의 목록을
 * 한 줄로 확인하려면 이 형태여야 한다(출제 순서는 picks 배열이 갖고 있다).
 */
export function formatPicks(picks: string[]): string {
  const numbers = [...new Set(picks.filter(isValidPickId).map(Number))].sort(
    (a, b) => a - b,
  );
  if (numbers.length === 0) return "";

  const parts: string[] = [];
  let start = numbers[0];
  let prev = numbers[0];

  const flush = () => {
    if (start === prev) parts.push(String(start));
    else if (prev - start === 1) parts.push(`${start}, ${prev}`);
    else parts.push(`${start}~${prev}`);
  };

  for (const n of numbers.slice(1)) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    flush();
    start = n;
    prev = n;
  }
  flush();

  return parts.join(", ");
}
