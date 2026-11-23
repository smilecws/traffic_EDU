import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SessionCalendar } from "@/app/admin/SessionCalendar";

/**
 * 달력 조회 화면의 핵심 흐름 — 금색 날짜 → 회차 목록 → 선택.
 * 브라우저 확인 대신 이 테스트로 런타임 깨짐과 클릭 경로를 잡는다.
 */

/** 요청된 달의 14일에 두 회차가 있는 것처럼 응답한다(달을 가정하지 않는다). */
function mockCalendarFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    const month = url.searchParams.get("month") ?? "";
    return new Response(
      JSON.stringify({
        month,
        days: [
          {
            date: `${month}-14`,
            sessions: 21,
            untagged: 0,
            groups: [
              { code: `1114-seoul-aaa`, sessions: 12 },
              { code: `1114-chuncheon-bbb`, sessions: 9 },
            ],
          },
        ],
        truncated: false,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
}

/** 두 날짜에 기록이 있는 응답 — 자동 펼침이 일어나지 않는 상황을 만든다. */
function mockTwoDayFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    const month = url.searchParams.get("month") ?? "";
    return new Response(
      JSON.stringify({
        month,
        days: [
          {
            date: `${month}-05`,
            sessions: 3,
            untagged: 3,
            groups: [],
          },
          {
            date: `${month}-14`,
            sessions: 21,
            untagged: 0,
            groups: [
              { code: "1114-seoul-aaa", sessions: 12 },
              { code: "1114-chuncheon-bbb", sessions: 9 },
            ],
          },
        ],
        truncated: false,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
}

function wrap(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockCalendarFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SessionCalendar", () => {
  it("기록이 있는 날만 누를 수 있다", async () => {
    wrap(
      <SessionCalendar
        selectedCode={null}
        onDayPick={() => {}}
        onSelect={() => {}}
        onSessionExpired={() => {}}
      />,
    );

    const day14 = await screen.findByRole("button", {
      name: "14일 세션 21건",
    });
    expect(day14).toBeEnabled();
    // 기록 없는 날은 비활성
    expect(screen.getByRole("button", { name: "13일" })).toBeDisabled();
  });

  it("하루만 기록이 있으면 회차 목록을 자동으로 펼친다", async () => {
    wrap(
      <SessionCalendar
        selectedCode={null}
        onDayPick={() => {}}
        onSelect={() => {}}
        onSessionExpired={() => {}}
      />,
    );

    expect(await screen.findByText("1114-seoul-aaa")).toBeInTheDocument();
    expect(screen.getByText("1114-chuncheon-bbb")).toBeInTheDocument();
    // 세션 수 내림차순으로 서버가 준 순서를 유지한다
    const codes = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => t.includes("1114-"));
    expect(codes[0]).toContain("1114-seoul-aaa");
  });

  it("회차를 누르면 코드와 날짜를 함께 넘긴다", async () => {
    const onSelect = vi.fn();
    wrap(
      <SessionCalendar
        selectedCode={null}
        onDayPick={() => {}}
        onSelect={onSelect}
        onSessionExpired={() => {}}
      />,
    );

    const group = await screen.findByText("1114-seoul-aaa");
    group.closest("button")?.click();

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    const [code, date] = onSelect.mock.calls[0];
    expect(code).toBe("1114-seoul-aaa");
    expect(date).toMatch(/^\d{4}-\d{2}-14$/);
  });

  it("날짜 칸을 누르면 그날 정보를 상위에 넘긴다", async () => {
    vi.stubGlobal("fetch", mockTwoDayFetch());
    const onDayPick = vi.fn();

    wrap(
      <SessionCalendar
        selectedCode={null}
        onDayPick={onDayPick}
        onSelect={() => {}}
        onSessionExpired={() => {}}
      />,
    );

    const day5 = await screen.findByRole("button", { name: "5일 세션 3건" });
    day5.click();

    await waitFor(() => expect(onDayPick).toHaveBeenCalledTimes(1));
    const picked = onDayPick.mock.calls[0][0];
    // 회차 코드 없는 응답만 있는 날 — 상위가 "조회할 회차 없음"을 띄울 수 있어야 한다
    expect(picked.groups).toEqual([]);
    expect(picked.untagged).toBe(3);
    expect(picked.date).toMatch(/^\d{4}-\d{2}-05$/);
  });

  it("펼친 날짜를 다시 누르면 null을 넘긴다(접기)", async () => {
    vi.stubGlobal("fetch", mockTwoDayFetch());
    const onDayPick = vi.fn();

    wrap(
      <SessionCalendar
        selectedCode={null}
        onDayPick={onDayPick}
        onSelect={() => {}}
        onSessionExpired={() => {}}
      />,
    );

    const day14 = await screen.findByRole("button", { name: "14일 세션 21건" });
    day14.click();
    await waitFor(() => expect(onDayPick).toHaveBeenCalledTimes(1));
    expect(onDayPick.mock.calls[0][0]).not.toBeNull();

    day14.click();
    await waitFor(() => expect(onDayPick).toHaveBeenCalledTimes(2));
    expect(onDayPick.mock.calls[1][0]).toBeNull();
  });

  it("조회 실패 시 서버 메시지를 보여준다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "달력 못 읽음" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    wrap(
      <SessionCalendar
        selectedCode={null}
        onDayPick={() => {}}
        onSelect={() => {}}
        onSessionExpired={() => {}}
      />,
    );

    expect(await screen.findByText("달력 못 읽음")).toBeInTheDocument();
  });

  it("세션이 만료되면 상위에 알린다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    const onSessionExpired = vi.fn();

    wrap(
      <SessionCalendar
        selectedCode={null}
        onDayPick={() => {}}
        onSelect={() => {}}
        onSessionExpired={onSessionExpired}
      />,
    );

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
});
