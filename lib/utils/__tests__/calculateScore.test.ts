import { describe, it, expect } from "vitest";
import { gradeSession, isAnswerCorrect } from "@/lib/utils/calculateScore";
import type { QuestionResult } from "@/lib/types";

describe("isAnswerCorrect", () => {
  it("단일 정답 — 일치하면 true", () => {
    expect(isAnswerCorrect([1], [1])).toBe(true);
  });

  it("단일 정답 — 불일치하면 false", () => {
    expect(isAnswerCorrect([2], [1])).toBe(false);
  });

  it("복수 정답 — 집합이 완전히 일치하면 true (순서 무관)", () => {
    expect(isAnswerCorrect([4, 3], [3, 4])).toBe(true);
  });

  it("복수 정답 — 일부만 맞으면 false", () => {
    expect(isAnswerCorrect([3], [3, 4])).toBe(false);
  });

  it("복수 정답 — 정답 외 선택이 섞이면 false", () => {
    expect(isAnswerCorrect([3, 4, 1], [3, 4])).toBe(false);
  });

  it("빈 선택은 false", () => {
    expect(isAnswerCorrect([], [1])).toBe(false);
  });
});

describe("gradeSession", () => {
  it("정답/오답 혼합 시 correctCount와 scorePercent를 정확히 계산한다", () => {
    const results: QuestionResult[] = [
      { questionId: "q1", selectedIds: [1], correct: true },
      { questionId: "q2", selectedIds: [2], correct: false },
      { questionId: "q3", selectedIds: [1], correct: true },
      { questionId: "q4", selectedIds: [1], correct: true },
    ];
    const res = gradeSession(results);
    expect(res.total).toBe(4);
    expect(res.correctCount).toBe(3);
    expect(res.scorePercent).toBe(75);
  });

  it("모두 정답이면 100%", () => {
    const results: QuestionResult[] = ["q1", "q2", "q3", "q4"].map((id) => ({
      questionId: id,
      selectedIds: [1],
      correct: true,
    }));
    const res = gradeSession(results);
    expect(res.scorePercent).toBe(100);
    expect(res.correctCount).toBe(4);
  });

  it("모두 오답이면 0%", () => {
    const results: QuestionResult[] = ["q1", "q2", "q3", "q4"].map((id) => ({
      questionId: id,
      selectedIds: [2],
      correct: false,
    }));
    const res = gradeSession(results);
    expect(res.scorePercent).toBe(0);
    expect(res.correctCount).toBe(0);
  });

  it("빈 결과는 0점", () => {
    const res = gradeSession([]);
    expect(res.total).toBe(0);
    expect(res.correctCount).toBe(0);
    expect(res.scorePercent).toBe(0);
  });

  it("finishedAt과 id는 주입한 값을 사용한다 (결정적)", () => {
    const res = gradeSession([], { id: "s1", finishedAt: 12345 });
    expect(res.id).toBe("s1");
    expect(res.finishedAt).toBe(12345);
  });
});
