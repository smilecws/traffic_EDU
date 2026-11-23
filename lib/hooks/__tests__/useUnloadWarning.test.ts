import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUnloadWarning } from "@/lib/hooks/useUnloadWarning";

/** 새로고침·탭 닫기 시 브라우저가 던지는 이벤트. */
function fireBeforeUnload() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe("useUnloadWarning", () => {
  it("enabled면 beforeunload를 막아 경고를 띄운다", () => {
    renderHook(() => useUnloadWarning(true));

    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  it("enabled가 false면 막지 않는다", () => {
    renderHook(() => useUnloadWarning(false));

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it("enabled가 꺼지면 경고도 꺼진다(채점 완료 등)", () => {
    const { rerender } = renderHook(
      ({ enabled }) => useUnloadWarning(enabled),
      { initialProps: { enabled: true } },
    );
    expect(fireBeforeUnload().defaultPrevented).toBe(true);

    rerender({ enabled: false });
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it("언마운트되면 리스너를 걷는다", () => {
    const { unmount } = renderHook(() => useUnloadWarning(true));
    unmount();

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});
