import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  firstWeekdayOfMonth,
  kstDayBoundary,
  kstMonthBoundary,
  shiftMonth,
  toKstDateString,
  toKstMonthString,
} from "@/lib/utils/kstDate";

describe("kstDayBoundary", () => {
  it("시작은 KST 00:00 = 전날 UTC 15:00", () => {
    expect(kstDayBoundary("2026-11-24", "start").toISOString()).toBe(
      "2026-11-23T15:00:00.000Z",
    );
  });

  it("종료는 KST 23:59:59.999 = 같은 날 UTC 14:59:59.999", () => {
    expect(kstDayBoundary("2026-11-24", "end").toISOString()).toBe(
      "2026-11-24T14:59:59.999Z",
    );
  });

  it("월 경계도 밀리지 않는다", () => {
    expect(kstDayBoundary("2026-01-01", "start").toISOString()).toBe(
      "2025-12-31T15:00:00.000Z",
    );
  });
});

describe("kstMonthBoundary", () => {
  it("그 달 1일 KST 00:00부터 마지막 날 KST 23:59:59.999까지", () => {
    expect(kstMonthBoundary("2026-11", "start").toISOString()).toBe(
      "2026-10-31T15:00:00.000Z",
    );
    expect(kstMonthBoundary("2026-11", "end").toISOString()).toBe(
      "2026-11-30T14:59:59.999Z",
    );
  });

  it("2월 윤년을 처리한다", () => {
    expect(kstMonthBoundary("2024-02", "end").toISOString()).toBe(
      "2024-02-29T14:59:59.999Z",
    );
    expect(kstMonthBoundary("2026-02", "end").toISOString()).toBe(
      "2026-02-28T14:59:59.999Z",
    );
  });
});

describe("toKstDateString", () => {
  it("UTC 자정 직후는 KST로 같은 날 오전 9시", () => {
    expect(toKstDateString(Date.parse("2026-11-24T00:30:00Z"))).toBe(
      "2026-11-24",
    );
  });

  it("UTC 16:00은 KST로 다음 날이다", () => {
    expect(toKstDateString(Date.parse("2026-11-24T16:00:00Z"))).toBe(
      "2026-11-25",
    );
  });

  it("UTC 14:59:59는 아직 KST 같은 날이다", () => {
    expect(toKstDateString(Date.parse("2026-11-24T14:59:59Z"))).toBe(
      "2026-11-24",
    );
  });

  it("달 경계에서도 KST 기준으로 넘어간다", () => {
    expect(toKstMonthString(Date.parse("2026-10-31T15:00:00Z"))).toBe("2026-11");
  });
});

describe("shiftMonth", () => {
  it("이전·다음 달로 이동한다", () => {
    expect(shiftMonth("2026-11", -1)).toBe("2026-10");
    expect(shiftMonth("2026-11", 1)).toBe("2026-12");
  });

  it("해를 넘긴다", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("daysInMonth / firstWeekdayOfMonth", () => {
  it("일수를 센다", () => {
    expect(daysInMonth("2026-11")).toBe(30);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2024-02")).toBe(29);
  });

  it("1일의 요일을 구한다 (2026-11-01은 일요일)", () => {
    expect(firstWeekdayOfMonth("2026-11")).toBe(0);
  });
});
