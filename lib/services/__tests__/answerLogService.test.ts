import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beaconAnswers,
  toAnswerLogItems,
} from "@/lib/services/answerLogService";
import { clearGroupCode, saveGroupCode } from "@/lib/services/groupCodeService";
import type { QuestionResult } from "@/lib/types";

/**
 * 풀이 도중 이탈 시의 집계 — 페이지가 닫히는 순간 비콘으로 보내는 경로.
 * 미응답이 섞이면 오답률 분모가 부풀고, 회차 코드가 빠지면 회차 통계에서 사라진다.
 */

const results: QuestionResult[] = [
  { questionId: "q1", selectedIds: [1], correct: true },
  { questionId: "q2", selectedIds: [2], correct: false },
  { questionId: "q3", selectedIds: [], correct: false }, // 미응답
];

describe("toAnswerLogItems", () => {
  it("실제로 답한 문제만 {q,c}로 남긴다", () => {
    expect(toAnswerLogItems(results)).toEqual([
      { q: "q1", c: true },
      { q: "q2", c: false },
    ]);
  });
});

describe("beaconAnswers", () => {
  const sendBeacon = vi.fn(() => true);

  beforeEach(() => {
    window.localStorage.clear();
    clearGroupCode();
    sendBeacon.mockClear();
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeacon,
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "sendBeacon");
  });

  async function sentBody(): Promise<unknown> {
    const calls = sendBeacon.mock.calls as unknown as [string, Blob][];
    return JSON.parse(await calls[0][1].text());
  }

  it("답한 문제를 회차 코드와 함께 /api/answer-log로 보낸다", async () => {
    saveGroupCode("1124-abc");
    expect(beaconAnswers(results)).toBe(true);

    const calls = sendBeacon.mock.calls as unknown as [string, Blob][];
    expect(calls[0][0]).toBe("/api/answer-log");
    expect(await sentBody()).toEqual({
      items: [
        { q: "q1", c: true },
        { q: "q2", c: false },
      ],
      g: "1124-abc",
    });
  });

  it("회차 코드가 없으면 g를 넣지 않는다", async () => {
    beaconAnswers(results);
    expect(await sentBody()).not.toHaveProperty("g");
  });

  it("답한 문제가 없으면 보내지 않는다", () => {
    expect(beaconAnswers([results[2]])).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
