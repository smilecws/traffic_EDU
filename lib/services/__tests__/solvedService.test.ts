import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSolved,
  getSolvedIds,
  markSolved,
} from "@/lib/services/solvedService";
import { addWrongNote } from "@/lib/services/wrongNoteService";

beforeEach(() => {
  window.localStorage.clear();
});

describe("solvedService", () => {
  it("푼 문제를 중복 없이 기록한다", () => {
    markSolved("q1");
    markSolved("q2");
    markSolved("q1");
    expect(getSolvedIds()).toEqual(["q1", "q2"]);
  });

  it("처음 읽을 때 오답노트 문제를 푼 문제로 옮겨 담는다", () => {
    addWrongNote({ questionId: "q9", selectedIds: [1], addedAt: 1 });
    expect(getSolvedIds()).toEqual(["q9"]);
  });

  it("초기화하면 오답노트 문제도 다시 안 푼 문제가 된다", () => {
    addWrongNote({ questionId: "q9", selectedIds: [1], addedAt: 1 });
    markSolved("q1");
    clearSolved();
    expect(getSolvedIds()).toEqual([]);
  });
});
