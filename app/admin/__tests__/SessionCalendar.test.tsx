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
        onSelect={() => {}}
        onSessionExpired={onSessionExpired}
      />,
    );

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });
});
