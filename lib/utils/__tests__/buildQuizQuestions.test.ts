import { describe, it, expect } from "vitest";
import { buildQuizQuestions } from "@/lib/utils/buildQuizQuestions";
import type { Question } from "@/lib/types";

function makeQuestion(id: string): Question {
  return {
    id,
    number: Number(id.replace(/\D/g, "")) || 0,
    question: `q-${id}`,
    choices: [
      { id: 0, text: "a" },
      { id: 1, text: "b" },
    ],
    answerIds: [0],
    explanation: "",
  };
}

const all: Question[] = Array.from({ length: 50 }, (_, i) =>
  makeQuestion(`q${i}`),
);

describe("buildQuizQuestions", () => {
  describe("wrong 모드", () => {
    it("지정 id만, 순서를 보존해 반환한다", () => {
      const wrongIds = ["q5", "q1", "q9"];
      const result = buildQuizQuestions("wrong", {
        all,
        wrongIds,
        favoriteIds: [],
      });
      expect(result.map((q) => q.id)).toEqual(["q5", "q1", "q9"]);
    });

    it("존재하지 않는 id는 무시한다", () => {
      const result = buildQuizQuestions("wrong", {
        all,
        wrongIds: ["q5", "nope", "q1"],
        favoriteIds: [],
      });
      expect(result.map((q) => q.id)).toEqual(["q5", "q1"]);
    });

    it("결과가 비면 빈 배열을 반환한다", () => {
      const result = buildQuizQuestions("wrong", {
        all,
        wrongIds: ["nope"],
        favoriteIds: [],
      });
      expect(result).toEqual([]);
    });
  });

  describe("favorite 모드", () => {
    it("지정 id만, 순서를 보존해 반환한다", () => {
      const favoriteIds = ["q3", "q7", "q0"];
      const result = buildQuizQuestions("favorite", {
        all,
        wrongIds: [],
        favoriteIds,
      });
      expect(result.map((q) => q.id)).toEqual(["q3", "q7", "q0"]);
    });

    it("존재하지 않는 id는 무시한다", () => {
      const result = buildQuizQuestions("favorite", {
        all,
        wrongIds: [],
        favoriteIds: ["q3", "missing", "q7"],
      });
      expect(result.map((q) => q.id)).toEqual(["q3", "q7"]);
    });
  });

  describe("questionIds 지정 (특정 문제만)", () => {
    it("모드와 무관하게 지정 id만 순서대로 반환", () => {
      const result = buildQuizQuestions(
        "random",
        { all, wrongIds: [], favoriteIds: [] },
        { questionIds: ["q9", "q3"] },
      );
      expect(result.map((q) => q.id)).toEqual(["q9", "q3"]);
    });

    it("단일 id면 그 문제 1개만", () => {
      const result = buildQuizQuestions(
        "random",
        { all, wrongIds: [], favoriteIds: [] },
        { questionIds: ["q42"] },
      );
      expect(result.map((q) => q.id)).toEqual(["q42"]);
    });

    it("존재하지 않는 id는 무시", () => {
      const result = buildQuizQuestions(
        "random",
        { all, wrongIds: [], favoriteIds: [] },
        { questionIds: ["q5", "nope"] },
      );
      expect(result.map((q) => q.id)).toEqual(["q5"]);
    });
  });

  describe("sequential 모드", () => {
    it("startNumber 이상인 문제를 번호 오름차순으로 전부 반환", () => {
      const result = buildQuizQuestions(
        "sequential",
        { all, wrongIds: [], favoriteIds: [] },
        { startNumber: 45 },
      );
      // all은 q0~q49(번호 0~49). 45 이상 → 45,46,47,48,49.
      expect(result.map((q) => q.number)).toEqual([45, 46, 47, 48, 49]);
    });

    it("startNumber 미지정이면 1번부터 전부(번호순)", () => {
      const result = buildQuizQuestions("sequential", {
        all,
        wrongIds: [],
        favoriteIds: [],
      });
      // 기본 시작 번호는 1 — 번호 0(q0)은 제외된다(실데이터는 1번부터).
      expect(result[0].number).toBe(1);
      expect(result[result.length - 1].number).toBe(49);
    });

    it("범위를 벗어난 startNumber는 빈 배열", () => {
      const result = buildQuizQuestions(
        "sequential",
        { all, wrongIds: [], favoriteIds: [] },
        { startNumber: 999 },
      );
      expect(result).toEqual([]);
    });
  });

  describe("유형 필터 (opts.type)", () => {
    const typed: Question[] = [
      { ...makeQuestion("q0"), type: "동영상문제" },
      { ...makeQuestion("q1"), type: "사진 및 상황 문제" },
      { ...makeQuestion("q2"), type: "동영상문제" },
      { ...makeQuestion("q3"), type: "도로교통법규 문제" },
    ];

    it("random 모드에서 지정 유형만 출제한다", () => {
      const result = buildQuizQuestions(
        "random",
        { all: typed, wrongIds: [], favoriteIds: [] },
        { type: "동영상문제" },
      );
      expect(result.map((q) => q.id).sort()).toEqual(["q0", "q2"]);
    });

    it("type 미지정이면 전체에서 출제한다", () => {
      const result = buildQuizQuestions("random", {
        all: typed,
        wrongIds: [],
        favoriteIds: [],
      });
      expect(result).toHaveLength(4);
    });

    it("해당 유형이 없으면 빈 배열", () => {
      const result = buildQuizQuestions(
        "random",
        { all: typed, wrongIds: [], favoriteIds: [] },
        { type: "없는유형" },
      );
      expect(result).toEqual([]);
    });
  });

  describe("random / mock 모드", () => {
    it("길이는 min(40, all.length)이고 모든 결과가 all의 원소다", () => {
      for (const mode of ["random", "mock"] as const) {
        const result = buildQuizQuestions(mode, {
          all,
          wrongIds: [],
          favoriteIds: [],
        });
        expect(result).toHaveLength(Math.min(40, all.length));
        const allIds = new Set(all.map((q) => q.id));
        for (const q of result) {
          expect(allIds.has(q.id)).toBe(true);
        }
        // 중복 없음
        expect(new Set(result.map((q) => q.id)).size).toBe(result.length);
      }
    });

    it("all이 40개 미만이면 가능한 만큼만 반환한다", () => {
      const few = all.slice(0, 10);
      const result = buildQuizQuestions("random", {
        all: few,
        wrongIds: [],
        favoriteIds: [],
      });
      expect(result).toHaveLength(10);
    });
  });
});
