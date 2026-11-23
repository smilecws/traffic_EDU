import { beforeEach, describe, expect, it } from "vitest";
import {
  buildGroupLink,
  saveGroupCode,
} from "@/lib/services/groupCodeService";
import {
  COMMENT_MAX_LENGTH,
  captureSurveyFlagFromSearch,
  clearSurveyState,
  getSurveyCode,
  getSurveyStateSnapshot,
  isSurveyDone,
  markSurveyDone,
  normalizeComment,
} from "@/lib/services/surveyService";

beforeEach(() => {
  window.localStorage.clear();
  clearSurveyState();
});

describe("captureSurveyFlagFromSearch", () => {
  it("?s=1과 회차 코드가 함께 오면 설문을 켠다", () => {
    saveGroupCode("1124-chuncheon-7k2");
    expect(
      captureSurveyFlagFromSearch("?g=1124-chuncheon-7k2&s=1", "1124-chuncheon-7k2"),
    ).toBe("1124-chuncheon-7k2");
    expect(getSurveyCode()).toBe("1124-chuncheon-7k2");
  });

  it("회차 코드가 없으면 무시한다 — 설문은 회차 단위다", () => {
    expect(captureSurveyFlagFromSearch("?s=1", null)).toBeNull();
    expect(getSurveyCode()).toBeNull();
  });

  it("?s=가 없으면 설문을 켜지 않는다(일반 회차 링크)", () => {
    saveGroupCode("1124-chuncheon-7k2");
    expect(
      captureSurveyFlagFromSearch("?g=1124-chuncheon-7k2", "1124-chuncheon-7k2"),
    ).toBeNull();
    expect(getSurveyCode()).toBeNull();
  });

  it("?s=1 이외의 값은 켜지 않는다", () => {
    saveGroupCode("1124a");
    captureSurveyFlagFromSearch("?g=1124a&s=0", "1124a");
    expect(getSurveyCode()).toBeNull();
  });
});

describe("getSurveyCode", () => {
  it("회차 코드가 풀리면 설문도 닫힌다", () => {
    saveGroupCode("1124a");
    captureSurveyFlagFromSearch("?g=1124a&s=1", "1124a");
    expect(getSurveyCode()).toBe("1124a");

    // 자정 경과 — 회차 코드가 만료되면 설문도 더는 열리지 않는다.
    saveGroupCode("1124a", Date.now() - 1);
    expect(getSurveyCode()).toBeNull();
  });

  it("다른 회차 QR로 다시 들어오면 이전 설문 플래그는 무효다", () => {
    saveGroupCode("1124a");
    captureSurveyFlagFromSearch("?g=1124a&s=1", "1124a");

    // 설문 없는 다른 회차로 교체 — 플래그는 남아 있지만 코드가 다르다.
    saveGroupCode("1124b");
    expect(getSurveyCode()).toBeNull();
  });

  it("만료된 플래그는 정리한다", () => {
    saveGroupCode("1124a");
    captureSurveyFlagFromSearch("?g=1124a&s=1", "1124a");
    window.localStorage.setItem(
      "quiz:surveyEnabled",
      JSON.stringify({ code: "1124a", expiresAt: Date.now() - 1 }),
    );
    expect(getSurveyCode()).toBeNull();
    expect(window.localStorage.getItem("quiz:surveyEnabled")).toBeNull();
  });
});

describe("markSurveyDone / isSurveyDone", () => {
  it("응답 완료는 회차별로 기록된다", () => {
    markSurveyDone("1124a");
    expect(isSurveyDone("1124a")).toBe(true);
    // 다음 교육(다른 회차)에서는 다시 응답할 수 있어야 한다.
    expect(isSurveyDone("1125b")).toBe(false);
  });

  it("같은 회차를 두 번 기록해도 하나만 남는다", () => {
    markSurveyDone("1124a");
    markSurveyDone("1124a");
    expect(
      JSON.parse(window.localStorage.getItem("quiz:surveyDone") ?? "[]"),
    ).toEqual(["1124a"]);
  });
});

describe("getSurveyStateSnapshot", () => {
  it("값이 그대로면 같은 참조를 돌려준다(무한 렌더 방지)", () => {
    saveGroupCode("1124a");
    captureSurveyFlagFromSearch("?g=1124a&s=1", "1124a");
    expect(getSurveyStateSnapshot()).toBe(getSurveyStateSnapshot());
  });

  it("응답을 마치면 done이 켜진다", () => {
    saveGroupCode("1124a");
    captureSurveyFlagFromSearch("?g=1124a&s=1", "1124a");
    expect(getSurveyStateSnapshot()).toEqual({ code: "1124a", done: false });

    markSurveyDone("1124a");
    expect(getSurveyStateSnapshot()).toEqual({ code: "1124a", done: true });
  });

  it("설문이 꺼진 회차에서는 코드가 null이다", () => {
    saveGroupCode("1124a");
    expect(getSurveyStateSnapshot()).toEqual({ code: null, done: false });
  });
});

describe("normalizeComment", () => {
  it("공백을 접고 양끝을 다듬는다", () => {
    expect(normalizeComment("  실습   시간이\n길면 좋겠습니다  ")).toBe(
      "실습 시간이 길면 좋겠습니다",
    );
  });

  it("제어문자를 공백으로 바꾼다", () => {
    expect(normalizeComment("좋았\u0000습니다")).toBe("좋았 습니다");
  });

  it("상한 길이로 자른다(보안 규칙과 같은 값)", () => {
    expect(normalizeComment("가".repeat(300))).toHaveLength(COMMENT_MAX_LENGTH);
  });
});

describe("buildGroupLink", () => {
  it("설문을 켜면 s=1이 붙는다", () => {
    expect(
      buildGroupLink("https://traffic-edu.vercel.app", "1124a", {
        survey: true,
      }),
    ).toBe("https://traffic-edu.vercel.app/?g=1124a&s=1");
  });

  it("끄면 예전과 같은 링크다", () => {
    expect(buildGroupLink("https://traffic-edu.vercel.app", "1124a")).toBe(
      "https://traffic-edu.vercel.app/?g=1124a",
    );
  });
});
