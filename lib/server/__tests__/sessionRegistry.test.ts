import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 만족도 응답의 **서버 검증** — ⑥의 핵심이 여기 있다.
 *
 * 예전에는 브라우저가 Firestore에 직접 썼고 보안 규칙은 형식만 봤다. 그래서
 * 설문을 켜지 않은 회차에도, 발급된 적 없는 코드로도 응답이 들어갔다. 이 네
 * 가지 거부 조건이 무너지면 그 구멍이 그대로 되돌아오므로 전부 고정해 둔다.
 */

/** firebase-admin을 실제로 띄우지 않는다 — 판단 로직만 검사한다. */
vi.mock("firebase-admin/firestore", () => {
  class Timestamp {
    constructor(private readonly ms: number) {}
    static fromDate(d: Date) {
      return new Timestamp(d.getTime());
    }
    toMillis() {
      return this.ms;
    }
  }
  const FieldValue = {
    serverTimestamp: () => "SERVER_TS",
    increment: (n: number) => ({ __increment: n }),
  };
  return { Timestamp, FieldValue };
});

const { Timestamp } = await import("firebase-admin/firestore");
const { recordSurveyResponse, SURVEY_RESPONSE_CAP } = await import(
  "@/lib/server/sessionRegistry"
);

/** 유효한 회차 문서 한 장. 필요한 필드만 바꿔 쓴다. */
function sessionDoc(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    branch: "음주",
    survey: true,
    createdAt: Timestamp.fromDate(new Date(now)),
    expiresAt: Timestamp.fromDate(new Date(now + 60_000)),
    surveyCount: 0,
    date: "2026-11-24",
    ...overrides,
  };
}

/** 트랜잭션만 흉내 내는 최소한의 Firestore. */
function makeDb(doc: Record<string, unknown> | null) {
  const created: { data: Record<string, unknown> }[] = [];
  const updated: { data: Record<string, unknown> }[] = [];

  const db = {
    collection: (name: string) => ({
      doc: (id?: string) => ({ id: id ?? "generated", collection: name }),
    }),
    runTransaction: async <T,>(
      fn: (tx: {
        get: (ref: { id: string }) => Promise<unknown>;
        create: (ref: unknown, data: Record<string, unknown>) => void;
        update: (ref: unknown, data: Record<string, unknown>) => void;
      }) => Promise<T>,
    ): Promise<T> =>
      fn({
        get: async (ref) => ({
          exists: doc !== null,
          id: ref.id,
          data: () => doc ?? undefined,
        }),
        create: (_ref, data) => {
          created.push({ data });
        },
        update: (_ref, data) => {
          updated.push({ data });
        },
      }),
  };

  // 테스트 전용 축소 모형이라 Firestore 전체 타입을 만족시키지 않는다.
  return { db: db as unknown as Parameters<typeof recordSurveyResponse>[0], created, updated };
}

const payload = {
  ratings: { overall: 5, useful: 4, instructor: 5 },
  comment: "",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordSurveyResponse", () => {
  it("등록되지 않은 코드는 거부한다", async () => {
    const { db, created } = makeDb(null);
    const result = await recordSurveyResponse(db, "1124-eumju-zzz", payload);

    expect(result).toEqual({ ok: false, reason: "unknown" });
    expect(created).toHaveLength(0);
  });

  it("설문을 켜지 않은 회차는 거부한다 — 링크에 s=1을 붙여도 소용없다", async () => {
    const { db, created } = makeDb(sessionDoc({ survey: false }));
    const result = await recordSurveyResponse(db, "1124-eumju-7k2", payload);

    expect(result).toEqual({ ok: false, reason: "closed" });
    expect(created).toHaveLength(0);
  });

  it("교육일이 지나면 거부한다 — 기기 시계가 아니라 서버 시각으로 본다", async () => {
    const past = Date.now() - 1_000;
    const { db, created } = makeDb(
      sessionDoc({ expiresAt: Timestamp.fromDate(new Date(past)) }),
    );
    const result = await recordSurveyResponse(db, "1124-eumju-7k2", payload);

    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(created).toHaveLength(0);
  });

  it("회차당 응답 상한을 넘으면 거부한다(대량 투입 차단)", async () => {
    const { db, created } = makeDb(
      sessionDoc({ surveyCount: SURVEY_RESPONSE_CAP }),
    );
    const result = await recordSurveyResponse(db, "1124-eumju-7k2", payload);

    expect(result).toEqual({ ok: false, reason: "full" });
    expect(created).toHaveLength(0);
  });

  it("조건을 모두 통과하면 응답을 적고 카운트를 올린다", async () => {
    const { db, created, updated } = makeDb(sessionDoc());
    const result = await recordSurveyResponse(db, "1124-eumju-7k2", payload);

    expect(result).toEqual({ ok: true });
    expect(created).toHaveLength(1);
    expect(created[0].data).toMatchObject({
      g: "1124-eumju-7k2",
      ratings: { overall: 5, useful: 4, instructor: 5 },
      createdAt: "SERVER_TS",
    });
    // 카운트 증가는 같은 트랜잭션에서 — 동시 제출이 상한을 함께 넘지 않게 한다.
    expect(updated[0].data).toEqual({ surveyCount: { __increment: 1 } });
  });

  it("주관식이 비면 필드 자체를 넣지 않는다", async () => {
    const { db, created } = makeDb(sessionDoc());
    await recordSurveyResponse(db, "1124-eumju-7k2", payload);

    expect(created[0].data).not.toHaveProperty("comment");
  });

  it("주관식이 있으면 그대로 싣는다", async () => {
    const { db, created } = makeDb(sessionDoc());
    await recordSurveyResponse(db, "1124-eumju-7k2", {
      ...payload,
      comment: "실습 시간이 길면 좋겠습니다",
    });

    expect(created[0].data).toMatchObject({
      comment: "실습 시간이 길면 좋겠습니다",
    });
  });
});
