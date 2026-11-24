import { beforeEach, describe, expect, it } from "vitest";
import { hasInAppHistory, markHistoryEntryPoint } from "@/lib/utils/appHistory";

describe("appHistory", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("진입 직후에는 앱 안 기록이 없다", () => {
    markHistoryEntryPoint();

    expect(hasInAppHistory()).toBe(false);
  });

  it("앱 안에서 한 번이라도 이동하면 기록이 생긴다", () => {
    markHistoryEntryPoint();
    window.history.pushState(null, "", "/quiz");

    expect(hasInAppHistory()).toBe(true);
  });

  it("뒤로 돌아와도 기록은 남아 있다(앞 항목이 아직 우리 것)", () => {
    markHistoryEntryPoint();
    window.history.pushState(null, "", "/quiz");
    window.history.pushState(null, "", "/quiz/history");

    expect(hasInAppHistory()).toBe(true);
  });
});
