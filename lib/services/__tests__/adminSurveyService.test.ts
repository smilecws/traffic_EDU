import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadAllSurveyStats,
  loadSurveyStats,
  toSurveyCsv,
} from "@/lib/services/adminSurveyService";
import { AdminSessionExpiredError } from "@/lib/services/adminStatsService";

/**
 * 평균 계산과 조회 조건 전달 — 서버 라우트는 분포만 주고, 평균·라벨 조인은
 * 여기서 한다. 숫자가 틀리면 강사가 보는 만족도 점수가 틀린다.
 */

/** 분포만 돌려주는 가짜 라우트. 요청 URL을 들여다볼 수 있게 fn을 돌려준다. */
function mockSurveyFetch(body: Record<string, unknown>, status = 200) {
  return vi.fn(async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("loadSurveyStats", () => {
  beforeEach(() => {
    globalThis.fetch = mockSurveyFetch({
      code: "1124a",
      from: "2026-11-24",
      to: "2026-11-24",
      responses: 4,
      distributions: {
        // 5,5,4,2 → 평균 4.00
        overall: [0, 1, 0, 1, 2],
        // 5,5,5,5 → 평균 5.00
        useful: [0, 0, 0, 0, 4],
        // 3,3,4,4 → 평균 3.50
        instructor: [0, 0, 2, 2, 0],
      },
      comments: ["실습 시간이 길면 좋겠습니다"],
    }) as unknown as typeof fetch;
  });

  it("분포에서 문항 평균을 낸다", async () => {
    const stats = await loadSurveyStats({
      code: "1124a",
      from: "2026-11-24",
      to: "2026-11-24",
    });

    expect(stats.items.map((i) => i.average)).toEqual([4, 5, 3.5]);
    expect(stats.items[0].answered).toBe(4);
    expect(stats.responses).toBe(4);
  });

  it("전체 평균은 문항 평균의 평균이다", async () => {
    const stats = await loadSurveyStats({
      code: "1124a",
      from: "2026-11-24",
      to: "2026-11-24",
    });
    // (4 + 5 + 3.5) / 3 = 4.1666… → 4.17
    expect(stats.overallAverage).toBe(4.17);
  });

  it("문항 라벨을 붙여 준다", async () => {
    const stats = await loadSurveyStats({
      code: "1124a",
      from: "2026-11-24",
      to: "2026-11-24",
    });
    expect(stats.items[0].label).toBe("전반적으로 만족하셨나요?");
  });
});

describe("빈 응답", () => {
  it("응답이 없으면 평균은 null이다(0점으로 깎지 않는다)", async () => {
    globalThis.fetch = mockSurveyFetch({
      code: "1124a",
      from: "2026-11-24",
      to: "2026-11-24",
      responses: 0,
      distributions: {
        overall: [0, 0, 0, 0, 0],
        useful: [0, 0, 0, 0, 0],
        instructor: [0, 0, 0, 0, 0],
      },
      comments: [],
    }) as unknown as typeof fetch;

    const stats = await loadSurveyStats({
      code: "1124a",
      from: "2026-11-24",
      to: "2026-11-24",
    });
    expect(stats.overallAverage).toBeNull();
    expect(stats.items.every((i) => i.average === null)).toBe(true);
  });
});

describe("loadAllSurveyStats", () => {
  it("기간을 비우면 날짜 조건을 싣지 않는다(전체 기간)", async () => {
    const fetchMock = mockSurveyFetch({
      code: "",
      from: "",
      to: "",
      responses: 0,
      distributions: {},
      comments: [],
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await loadAllSurveyStats({});
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("scope=all");
    expect(url).not.toContain("from=");
  });

  it("기간을 주면 함께 싣는다", async () => {
    const fetchMock = mockSurveyFetch({
      code: "",
      from: "2026-11-01",
      to: "2026-11-23",
      responses: 0,
      distributions: {},
      comments: [],
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await loadAllSurveyStats({ from: "2026-11-01", to: "2026-11-23" });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("from=2026-11-01");
    expect(url).toContain("to=2026-11-23");
  });
});

describe("세션 만료", () => {
  it("401은 전용 에러로 올린다(화면이 다시 로그인을 띄우도록)", async () => {
    globalThis.fetch = mockSurveyFetch(
      { error: "unauthorized" },
      401,
    ) as unknown as typeof fetch;

    await expect(
      loadSurveyStats({ code: "1124a", from: "2026-11-24", to: "2026-11-24" }),
    ).rejects.toBeInstanceOf(AdminSessionExpiredError);
  });
});

describe("toSurveyCsv", () => {
  it("문항 분포와 주관식을 함께 내보낸다", async () => {
    globalThis.fetch = mockSurveyFetch({
      code: "1124a",
      from: "2026-11-24",
      to: "2026-11-24",
      responses: 2,
      distributions: {
        overall: [0, 0, 0, 1, 1],
        useful: [0, 0, 0, 0, 2],
        instructor: [0, 0, 1, 1, 0],
      },
      comments: ['따옴표 "포함" 의견'],
    }) as unknown as typeof fetch;

    const csv = toSurveyCsv(
      await loadSurveyStats({
        code: "1124a",
        from: "2026-11-24",
        to: "2026-11-24",
      }),
    );

    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("전반적으로 만족하셨나요?");
    expect(csv).toContain("주관식 의견");
    // 큰따옴표는 두 번 겹쳐 escape 한다.
    expect(csv).toContain('"따옴표 ""포함"" 의견"');
  });
});
