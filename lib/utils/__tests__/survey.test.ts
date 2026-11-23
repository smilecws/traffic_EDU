import { describe, expect, it } from "vitest";
import { parseRatings } from "@/lib/utils/survey";

/**
 * `parseRatings`는 서버 라우트가 요청 본문을 믿지 않고 통과시키는 관문이다.
 * 보안 규칙이 하던 "1~5 정수인가" 검사를 이제 여기서 한다 —
 * `survey_responses`는 클라이언트 쓰기가 막혀 있고 서버만 기록하기 때문이다.
 */

const valid = { overall: 5, useful: 4, instructor: 3 };

describe("parseRatings", () => {
  it("세 문항이 1~5 정수면 통과한다", () => {
    expect(parseRatings(valid)).toEqual(valid);
  });

  it("모르는 필드는 떨어뜨린다 — 임의 필드가 Firestore로 새지 않는다", () => {
    expect(parseRatings({ ...valid, evil: "x", g: "다른회차" })).toEqual(valid);
  });

  it("한 문항이라도 빠지면 null", () => {
    expect(parseRatings({ overall: 5, useful: 4 })).toBeNull();
  });

  it("범위를 벗어나면 null", () => {
    expect(parseRatings({ ...valid, overall: 0 })).toBeNull();
    expect(parseRatings({ ...valid, overall: 6 })).toBeNull();
  });

  it("정수가 아니면 null", () => {
    expect(parseRatings({ ...valid, useful: 4.5 })).toBeNull();
    expect(parseRatings({ ...valid, useful: "5" })).toBeNull();
    expect(parseRatings({ ...valid, useful: null })).toBeNull();
  });

  it("객체가 아니면 null", () => {
    expect(parseRatings(null)).toBeNull();
    expect(parseRatings("5")).toBeNull();
    expect(parseRatings([5, 4, 3])).toBeNull();
  });
});
