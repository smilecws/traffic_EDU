import { describe, expect, it } from "vitest";
import {
  MAX_PICKS,
  formatPicks,
  normalizePicks,
  parsePickInput,
} from "@/lib/utils/questionPicks";

describe("normalizePicks", () => {
  it("문자열 번호만 남기고 순서를 보존한다", () => {
    expect(normalizePicks(["12", "3", "45"])).toEqual(["12", "3", "45"]);
  });

  it("숫자로 들어온 값도 문자열로 맞춘다", () => {
    expect(normalizePicks([12, 3])).toEqual(["12", "3"]);
  });

  it("중복은 먼저 나온 것만 남긴다", () => {
    expect(normalizePicks(["7", "7", "8"])).toEqual(["7", "8"]);
  });

  it("형식에 맞지 않는 값은 버린다", () => {
    expect(
      normalizePicks(["0", "-1", "1.5", "", "abc", null, undefined, {}, "12"]),
    ).toEqual(["12"]);
  });

  it("배열이 아니면 빈 배열", () => {
    expect(normalizePicks("12,13")).toEqual([]);
    expect(normalizePicks(null)).toEqual([]);
  });

  it("상한을 넘으면 앞에서부터 자른다", () => {
    const many = Array.from({ length: MAX_PICKS + 20 }, (_, i) => String(i + 1));
    const picks = normalizePicks(many);
    expect(picks).toHaveLength(MAX_PICKS);
    expect(picks[0]).toBe("1");
  });
});

describe("parsePickInput", () => {
  it("쉼표·공백·줄바꿈을 모두 구분자로 받는다", () => {
    expect(parsePickInput("12, 45 101\n3").picks).toEqual([
      "12",
      "45",
      "101",
      "3",
    ]);
  });

  it("범위 표기를 펼친다(- 과 ~ 둘 다)", () => {
    expect(parsePickInput("101-104").picks).toEqual([
      "101",
      "102",
      "103",
      "104",
    ]);
    expect(parsePickInput("7~9").picks).toEqual(["7", "8", "9"]);
  });

  it("거꾸로 적은 범위도 오름차순으로 읽는다", () => {
    expect(parsePickInput("9-7").picks).toEqual(["7", "8", "9"]);
  });

  it("읽지 못한 토큰을 조용히 버리지 않고 돌려준다", () => {
    const { picks, invalid } = parsePickInput("12, 사십오, 0, 101");
    expect(picks).toEqual(["12", "101"]);
    expect(invalid).toEqual(["사십오", "0"]);
  });

  it("중복을 합친다", () => {
    expect(parsePickInput("5, 5-7, 6").picks).toEqual(["5", "6", "7"]);
  });

  it("상한을 넘으면 잘라내고 truncated를 알린다", () => {
    const { picks, truncated } = parsePickInput(`1-${MAX_PICKS + 50}`);
    expect(picks).toHaveLength(MAX_PICKS);
    expect(truncated).toBe(true);
  });

  it("빈 입력은 빈 결과", () => {
    expect(parsePickInput("   ")).toEqual({
      picks: [],
      invalid: [],
      truncated: false,
    });
  });
});

describe("formatPicks", () => {
  it("연속 구간을 접고 번호순으로 정렬한다", () => {
    expect(formatPicks(["3", "1", "2", "8", "12", "13", "14"])).toBe(
      "1~3, 8, 12~14",
    );
  });

  it("두 개뿐인 구간은 접지 않는다", () => {
    expect(formatPicks(["4", "5"])).toBe("4, 5");
  });

  it("비어 있으면 빈 문자열", () => {
    expect(formatPicks([])).toBe("");
  });
});
