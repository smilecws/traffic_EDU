// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 비콘 수신 라우트 — 보안 규칙(isValidAnswerLog)을 우회하는 뒷문이 되면 안 된다.
 * 규칙과 같은 형태만 받아들이는지 고정한다.
 */

const added: Record<string, unknown>[] = [];

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TS" },
  Timestamp: class {},
}));

vi.mock("@/lib/server/firebaseAdmin", () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      add: async (data: Record<string, unknown>) => {
        added.push({ __collection: name, ...data });
      },
    }),
  }),
}));

const { POST } = await import("@/app/api/answer-log/route");

function req(body: unknown) {
  return new Request("http://localhost/api/answer-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  added.length = 0;
});

describe("POST /api/answer-log", () => {
  it("올바른 로그를 서버 시각과 회차 코드로 answer_logs에 적는다", async () => {
    const res = await POST(req({ items: [{ q: "q1", c: true }], g: "1124-ABC" }));
    expect(res.status).toBe(204);
    expect(added).toEqual([
      {
        __collection: "answer_logs",
        items: [{ q: "q1", c: true }],
        createdAt: "SERVER_TS",
        g: "1124-abc",
      },
    ]);
  });

  it("회차 코드가 없으면 g 없이 적는다", async () => {
    await POST(req({ items: [{ q: "q1", c: false }] }));
    expect(added[0]).not.toHaveProperty("g");
  });

  it.each([
    ["JSON이 아님", "not json"],
    ["items 없음", {}],
    ["빈 items", { items: [] }],
    ["200개 초과", { items: Array.from({ length: 201 }, () => ({ q: "q", c: true })) }],
    ["c가 불리언이 아님", { items: [{ q: "q1", c: "yes" }] }],
    ["q가 빈 문자열", { items: [{ q: "", c: true }] }],
    ["형식이 틀린 회차 코드", { items: [{ q: "q1", c: true }], g: "홍길동반" }],
  ])("거부한다 — %s", async (_label, body) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(added).toHaveLength(0);
  });

  it("문항에 다른 필드를 섞어 보내도 q·c만 적는다", async () => {
    await POST(req({ items: [{ q: "q1", c: true, extra: "x" }] }));
    expect(added[0].items).toEqual([{ q: "q1", c: true }]);
  });
});
