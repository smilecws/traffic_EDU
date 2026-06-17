/**
 * 사용자 이름(닉네임) 검증 — 순수·결정적 함수.
 *
 * 규칙:
 * - trim 후 연속 공백을 하나로 축약한 값을 value로 한다.
 * - 2~30자.
 * - 한글 완성형(가-힣) 또는 영문 알파벳이 최소 1자 포함(letter ≥ 1).
 * - 빈 문자열, 숫자/이모지/특수기호로만 이루어진 값은 거부.
 * - error는 한국어 안내 문구.
 */
export function validateName(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim().replace(/\s+/g, " ");

  if (value.length === 0) {
    return { ok: false, error: "이름을 입력해 주세요" };
  }
  if (value.length < 2) {
    return { ok: false, error: "2자 이상 입력해 주세요" };
  }
  if (value.length > 30) {
    return { ok: false, error: "30자 이하로 입력해 주세요" };
  }
  // 한글 완성형 또는 영문 알파벳이 최소 1자 포함되어야 한다.
  if (!/[가-힣a-zA-Z]/.test(value)) {
    return { ok: false, error: "한글 또는 영문을 포함해 주세요" };
  }

  return { ok: true, value };
}
