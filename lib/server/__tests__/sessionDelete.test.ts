import { describe, expect, it, vi } from "vitest";

/**
 * 회차·통계 삭제 — Firestore에서 **실제로** 지우는지, 그리고 다른 회차의
 * 기록은 건드리지 않는지를 고정한다. 되돌릴 수 없는 동작이라 범위가 어긋나면
 * 그대로 데이터 손실이 된다.
 */

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
  return {
    Timestamp,
    FieldValue: { serverTimestamp: () => "SERVER_TS", increment: (n: number) => n },
  };
});

const { deleteSession, deleteSessionStats } = await import(
  "@/lib/server/sessionRegistry"
);

type Doc = Record<string, unknown>;
type Store = Record<string, Map<string, Doc>>;

/** where("g","==",…)·limit·batch·doc 만 흉내 내는 메모리 Firestore. */
function makeDb(store: Store) {
  const col = (name: string) => (store[name] ??= new Map());
  const ref = (name: string, id: string) => ({
    get: async () => ({ exists: col(name).has(id), data: () => col(name).get(id) }),
    update: async (patch: Doc) => {
      col(name).set(id, { ...col(name).get(id), ...patch });
    },
    delete: async () => {
      col(name).delete(id);
    },
    __name: name,
    __id: id,
  });

  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ref(name, id),
      where: (field: string, _op: string, value: unknown) => ({
        limit: (n: number) => ({
          get: async () => {
            const docs = [...col(name).entries()]
              .filter(([, d]) => d[field] === value)
              .slice(0, n)
              .map(([id]) => ({ ref: ref(name, id) }));
            return { empty: docs.length === 0, size: docs.length, docs };
          },
        }),
      }),
    }),
    batch: () => {
      const pending: ReturnType<typeof ref>[] = [];
      return {
        delete: (r: ReturnType<typeof ref>) => pending.push(r),
        commit: async () => {
          for (const r of pending) col(r.__name).delete(r.__id);
        },
      };
    },
  };
  return db as unknown as Parameters<typeof deleteSession>[0];
}

function seed(): Store {
  const answerLogs = new Map<string, Doc>();
  // 묶음 크기(400)를 넘겨 여러 번 나눠 지우는지도 함께 본다.
  for (let i = 0; i < 450; i += 1) answerLogs.set(`a${i}`, { g: "1124-abc" });
  answerLogs.set("other", { g: "1124-xyz" });
  answerLogs.set("untagged", { items: [] });

  return {
    sessions: new Map([
      ["1124-abc", { branch: "음주반", surveyCount: 3 }],
      ["1124-xyz", { branch: "다른반", surveyCount: 1 }],
    ]),
    survey_responses: new Map([
      ["s1", { g: "1124-abc" }],
      ["s2", { g: "1124-abc" }],
      ["s3", { g: "1124-abc" }],
      ["s4", { g: "1124-xyz" }],
    ]),
    answer_logs: answerLogs,
  };
}

describe("deleteSession", () => {
  it("회차와 그 회차의 만족도 응답·오답 기록을 함께 지운다", async () => {
    const store = seed();
    const result = await deleteSession(makeDb(store), "1124-abc");

    expect(result).toEqual({ answerLogs: 450, surveyResponses: 3, session: true });
    expect(store.sessions.has("1124-abc")).toBe(false);
    expect([...store.survey_responses.values()].some((d) => d.g === "1124-abc")).toBe(false);
    expect([...store.answer_logs.values()].some((d) => d.g === "1124-abc")).toBe(false);
  });

  it("다른 회차와 코드 없는 기록은 건드리지 않는다", async () => {
    const store = seed();
    await deleteSession(makeDb(store), "1124-abc");

    expect(store.sessions.has("1124-xyz")).toBe(true);
    expect(store.survey_responses.has("s4")).toBe(true);
    expect(store.answer_logs.has("other")).toBe(true);
    expect(store.answer_logs.has("untagged")).toBe(true);
  });

  it("등록부에 없는 코드여도 남은 기록은 지운다", async () => {
    const store = seed();
    store.sessions.delete("1124-abc");
    const result = await deleteSession(makeDb(store), "1124-abc");

    expect(result.session).toBe(false);
    expect(result.answerLogs).toBe(450);
  });
});

describe("deleteSessionStats", () => {
  it("통계만 지우고 QR 회차는 남기며 응답 수를 0으로 되돌린다", async () => {
    const store = seed();
    const result = await deleteSessionStats(makeDb(store), "1124-abc");

    expect(result).toEqual({ answerLogs: 450, surveyResponses: 3, session: false });
    expect(store.sessions.get("1124-abc")).toEqual({ branch: "음주반", surveyCount: 0 });
    expect(store.sessions.get("1124-xyz")).toEqual({ branch: "다른반", surveyCount: 1 });
    expect(store.survey_responses.has("s4")).toBe(true);
    expect(store.answer_logs.has("other")).toBe(true);
  });
});
