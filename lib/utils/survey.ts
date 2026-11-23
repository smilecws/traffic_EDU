/**
 * 만족도 조사의 순수 규칙 — 문항 목록, 척도 범위, 주관식 정리.
 *
 * 브라우저와 서버 라우트가 **같은 기준으로** 검증해야 한다. 화면에서 통과한
 * 입력이 서버에서 거부되면 교육생은 이유를 알 수 없고, 반대면 검증이 없는
 * 것과 같다. 그래서 localStorage도 네트워크도 모르는 이 모듈에 모아 둔다.
 */

/** 주관식 최대 길이. 보안 규칙의 상한과 동일하게 유지할 것. */
export const COMMENT_MAX_LENGTH = 200;

/** 척도 선택지 — 1~5. */
export const RATING_SCALE = [1, 2, 3, 4, 5] as const;

/**
 * 척도 문항. **5가 항상 긍정**이어야 평균을 그대로 만족도로 읽을 수 있다.
 * 그래서 "난이도"처럼 중간이 좋은 문항은 넣지 않았다(평균이 뜻을 잃는다).
 *
 * id는 Firestore 문서의 키이자 보안 규칙의 화이트리스트다 — 바꾸려면
 * `firestore.rules`의 `isValidSurvey`도 같이 고쳐야 한다.
 */
export const SURVEY_QUESTIONS = [
  { id: "overall", label: "전반적으로 만족하셨나요?" },
  { id: "useful", label: "교육 내용이 업무에 도움이 되었나요?" },
  { id: "instructor", label: "강사의 설명이 이해하기 쉬웠나요?" },
] as const;

/** 척도 문항 id. */
export type SurveyRatingId = (typeof SURVEY_QUESTIONS)[number]["id"];

/** 문항 id → 1~5 점수. 세 문항 모두 필수다. */
export type SurveyRatings = Record<SurveyRatingId, number>;

/** 척도 점수가 1~5 정수인지. */
export function isValidRating(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;
}

/**
 * 임의의 입력에서 세 문항짜리 점수표를 꺼낸다. 하나라도 1~5 정수가 아니면 null.
 * 서버 라우트가 본문을 믿지 않고 통과시키는 관문이다.
 */
export function parseRatings(raw: unknown): SurveyRatings | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const out = {} as SurveyRatings;
  for (const { id } of SURVEY_QUESTIONS) {
    const value = source[id];
    if (!isValidRating(value)) return null;
    out[id] = value;
  }
  return out;
}

/**
 * 주관식 입력을 저장 가능한 형태로 다듬는다.
 * 제어문자를 지우고 공백을 접은 뒤 상한 길이로 자른다. 비면 빈 문자열.
 */
export function normalizeComment(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, COMMENT_MAX_LENGTH);
}
