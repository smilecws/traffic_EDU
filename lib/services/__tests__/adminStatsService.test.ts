import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@/lib/types";
import type { Classifier } from "@/lib/services/questionClassifier";
import {
  AdminSessionExpiredError,
  loadAllStats,
  loadGroupStats,
  maxUsableMinAttempts,
  toCsv,
} from "@/lib/services/adminStatsService";

const questions: Question[] = [
  {
    id: "q1",
    number: 1,
    question: "문제 하나",
    choices: [
      { id: 1, text: "가" },
      { id: 2, text: "나" },
    ],
    answerIds: [1],
    explanation: "해설 하나",
  },
  {
    id: "q2",
    number: 2,
    question: "문제 둘",
    choices: [
      { id: 1, text: "가" },
      { id: 2, text: "나" },
    ],
    answerIds: [2],
    explanation: "해설 둘",
  },
];

/** 모든 문항을 한 묶음에 넣는 단순 분류기. */
const classifier: Classifier = {
  id: "flat",
  label: "묶음",
  classify: () => ({ key: "all", label: "전체" }),
  buckets: () => [{ key: "all", label: "전체" }],
};

function mockStats(counts: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "1124-seoul-7k2",
            from: "2026-11-24",
            to: "2026-11-24",
            sessions: 3,
            counts,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadGroupStats", () => {
  it("문항별 카운트에 문제 전문을 조인해 넘긴다", async () => {
    mockStats([{ questionId: "q1", attempts: 10, wrong: 7 }]);

    const stats = await loadGroupStats({
      code: "1124-seoul-7k2",
      from: "2026-11-24",
      to: "2026-11-24",
      questions,
      classifier,
    });

    const row = stats.questions[0];
    expect(row.number).toBe(1);
    // 화면이 선택지·정답·해설을 그릴 수 있도록 문제 객체가 함께 와야 한다
    expect(row.question?.answerIds).toEqual([1]);
    expect(row.question?.explanation).toBe("해설 하나");
    expect(row.wrongRate).toBe(0.7);
  });

  it("문제 데이터에 없는 id는 버리지 않고 question을 null로 둔다", async () => {
    mockStats([{ questionId: "q999", attempts: 4, wrong: 4 }]);

    const stats = await loadGroupStats({
      code: "1124-seoul-7k2",
      from: "2026-11-24",
      to: "2026-11-24",
      questions,
      classifier,
    });

    expect(stats.questions).toHaveLength(1);
    expect(stats.questions[0].question).toBeNull();
    expect(stats.questions[0].text).toContain("문제 데이터 없음");
  });

  it("전체 오답률을 집계한다", async () => {
    mockStats([
      { questionId: "q1", attempts: 10, wrong: 7 },
      { questionId: "q2", attempts: 10, wrong: 3 },
    ]);

    const stats = await loadGroupStats({
      code: "1124-seoul-7k2",
      from: "2026-11-24",
      to: "2026-11-24",
      questions,
      classifier,
    });

    expect(stats.attempts).toBe(20);
    expect(stats.wrong).toBe(10);
    expect(stats.wrongRate).toBe(0.5);
    // 오답률 내림차순
    expect(stats.questions.map((q) => q.questionId)).toEqual(["q1", "q2"]);
  });

  it("401이면 세션 만료 에러를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );

    await expect(
      loadGroupStats({
        code: "1124-seoul-7k2",
        from: "2026-11-24",
        to: "2026-11-24",
        questions,
        classifier,
      }),
    ).rejects.toThrow(AdminSessionExpiredError);
  });

  it("회차 조회는 scope를 group으로 표시한다", async () => {
    mockStats([{ questionId: "q1", attempts: 2, wrong: 1 }]);

    const stats = await loadGroupStats({
      code: "1124-seoul-7k2",
      from: "2026-11-24",
      to: "2026-11-24",
      questions,
      classifier,
    });

    expect(stats.scope).toBe("group");
    expect(stats.code).toBe("1124-seoul-7k2");
  });
});

describe("loadAllStats", () => {
  /** 호출된 URL을 기록해 두는 상자 — 질의 문자열을 검증하는 데 쓴다. */
  const requested: string[] = [];

  /**
   * 회차 무관 응답. code는 항상 빈 문자열이고, from·to는 기간을 지정했을 때만
   * 채워진다(라우트와 같은 규칙).
   */
  function mockAllStats(
    counts: unknown,
    { sessions = 540, from = "", to = "" } = {},
  ) {
    requested.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        requested.push(String(input));
        return new Response(
          JSON.stringify({
            scope: "all",
            code: "",
            from,
            to,
            sessions,
            counts,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
  }

  it("기간을 주지 않으면 scope=all만 보낸다(전체 기간)", async () => {
    mockAllStats([{ questionId: "q1", attempts: 9, wrong: 9 }]);

    await loadAllStats({ questions, classifier });

    expect(requested).toHaveLength(1);
    expect(requested[0]).toContain("scope=all");
    expect(requested[0]).not.toContain("code=");
    expect(requested[0]).not.toContain("from=");
  });

  it("기간을 주면 from·to를 함께 보낸다", async () => {
    mockAllStats([], { from: "2026-11-01", to: "2026-11-23" });

    await loadAllStats({
      from: "2026-11-01",
      to: "2026-11-23",
      questions,
      classifier,
    });

    expect(requested[0]).toContain("scope=all");
    expect(requested[0]).toContain("from=2026-11-01");
    expect(requested[0]).toContain("to=2026-11-23");
  });

  it("한쪽만 있는 기간은 싣지 않는다(서버 400 방지)", async () => {
    mockAllStats([]);

    await loadAllStats({ from: "2026-11-01", questions, classifier });

    expect(requested[0]).not.toContain("from=");
    expect(requested[0]).not.toContain("to=");
  });

  it("기간 조회 결과는 from·to를 그대로 돌려준다", async () => {
    mockAllStats([{ questionId: "q1", attempts: 4, wrong: 1 }], {
      from: "2026-11-01",
      to: "2026-11-23",
      sessions: 42,
    });

    const stats = await loadAllStats({
      from: "2026-11-01",
      to: "2026-11-23",
      questions,
      classifier,
    });

    expect(stats.scope).toBe("all");
    expect(stats.from).toBe("2026-11-01");
    expect(stats.to).toBe("2026-11-23");
    expect(stats.sessions).toBe(42);
  });

  it("회차 무관 집계도 회차와 같은 모양으로 가공한다", async () => {
    mockAllStats([
      { questionId: "q1", attempts: 10, wrong: 2 },
      { questionId: "q2", attempts: 10, wrong: 8 },
    ]);

    const stats = await loadAllStats({ questions, classifier });

    expect(stats.scope).toBe("all");
    expect(stats.sessions).toBe(540);
    expect(stats.attempts).toBe(20);
    expect(stats.wrongRate).toBe(0.5);
    // 오답률 내림차순 — 회차 조회와 동일한 정렬
    expect(stats.questions.map((q) => q.questionId)).toEqual(["q2", "q1"]);
    // 문제 전문 조인도 그대로 동작한다
    expect(stats.questions[0].question?.explanation).toBe("해설 둘");
  });

  it("전체 기간 조회는 code·from·to가 빈 문자열이다", async () => {
    mockAllStats([]);

    const stats = await loadAllStats({ questions, classifier });

    expect(stats.code).toBe("");
    expect(stats.from).toBe("");
    expect(stats.to).toBe("");
  });

  it("401이면 세션 만료 에러를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );

    await expect(loadAllStats({ questions, classifier })).rejects.toThrow(
      AdminSessionExpiredError,
    );
  });
});

describe("toCsv", () => {
  const base = {
    scope: "group" as const,
    code: "1124-seoul-7k2",
    from: "2026-11-24",
    to: "2026-11-24",
    sessions: 3,
    attempts: 20,
    wrong: 10,
    wrongRate: 0.5,
  };

  it("오답이 0건인 문항은 내보내지 않는다", () => {
    const csv = toCsv(
      {
        ...base,
        questions: [
          {
            questionId: "q1",
            number: 1,
            text: "틀린 문제",
            bucketLabel: "전체",
            question: null,
            attempts: 10,
            wrong: 7,
            wrongRate: 0.7,
          },
          {
            questionId: "q2",
            number: 2,
            text: "다 맞힌 문제",
            bucketLabel: "전체",
            question: null,
            attempts: 10,
            wrong: 0,
            wrongRate: 0,
          },
        ],
      },
      1,
    );

    expect(csv).toContain("틀린 문제");
    expect(csv).not.toContain("다 맞힌 문제");
  });

  it("최소 응답 수 미달 문항도 제외한다", () => {
    const csv = toCsv(
      {
        ...base,
        questions: [
          {
            questionId: "q1",
            number: 1,
            text: "응답 1건뿐",
            bucketLabel: "전체",
            question: null,
            attempts: 1,
            wrong: 1,
            wrongRate: 1,
          },
        ],
      },
      2,
    );

    expect(csv).not.toContain("응답 1건뿐");
  });

  it("엑셀 한글 깨짐 방지용 BOM을 붙인다", () => {
    const csv = toCsv({ ...base, questions: [] }, 1);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});

describe("maxUsableMinAttempts", () => {
  it("세션 1회 회차(모든 문항 1건)는 1로 내린다", () => {
    // 기본값 2건으로는 오답 34건이 통째로 숨던 상황
    const questions = Array.from({ length: 34 }, () => ({
      attempts: 1,
      wrong: 1,
    }));
    expect(maxUsableMinAttempts(questions)).toBe(1);
  });

  it("응답이 넉넉하면 기본값을 건드리지 않는다(최대 선택지)", () => {
    expect(maxUsableMinAttempts([{ attempts: 40, wrong: 9 }])).toBe(10);
  });

  it("선택지에 없는 값은 그 아래 선택지로 맞춘다", () => {
    // 4건까지 가능 → 선택지 [1,2,3,5,10] 중 3
    expect(maxUsableMinAttempts([{ attempts: 4, wrong: 2 }])).toBe(3);
  });

  it("다 맞힌 문항의 응답 수는 기준으로 쓰지 않는다", () => {
    const questions = [
      { attempts: 20, wrong: 0 }, // 전원 정답 — 목록에 안 나온다
      { attempts: 1, wrong: 1 },
    ];
    expect(maxUsableMinAttempts(questions)).toBe(1);
  });

  it("틀린 문항이 없으면 null", () => {
    expect(maxUsableMinAttempts([{ attempts: 9, wrong: 0 }])).toBeNull();
    expect(maxUsableMinAttempts([])).toBeNull();
  });
});
