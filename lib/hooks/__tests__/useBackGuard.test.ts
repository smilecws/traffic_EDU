import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBackGuard } from "@/lib/hooks/useBackGuard";

/** jsdom의 history.back()은 비동기로 popstate를 던지므로 넉넉히 기다린다. */
async function tick(ms = 50) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/** 브라우저 뒤로가기 버튼 누름. */
async function pressBrowserBack() {
  act(() => {
    window.history.back();
  });
  await tick();
}

describe("useBackGuard", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/quiz/play");
  });

  it("가드를 심어 두고, 브라우저 뒤로가기를 onLeave로 돌린다", async () => {
    const onLeave = vi.fn();
    renderHook(() => useBackGuard({ onLeave }));

    expect(window.history.state).toMatchObject({ backGuard: true });

    await pressBrowserBack();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("confirmLeave가 false면 떠나지 않고 가드를 다시 심는다", async () => {
    const onLeave = vi.fn();
    const confirmLeave = vi.fn(() => false);
    renderHook(() => useBackGuard({ onLeave, confirmLeave }));

    await pressBrowserBack();

    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
    expect(window.history.state).toMatchObject({ backGuard: true });

    // 한 번 더 눌러 확인을 통과하면 그때 떠난다.
    confirmLeave.mockReturnValue(true);
    await pressBrowserBack();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("requestLeave(앱 ← 버튼)도 확인을 거쳐 같은 onLeave로 떠난다", async () => {
    const onLeave = vi.fn();
    const confirmLeave = vi.fn(() => true);
    const { result } = renderHook(() => useBackGuard({ onLeave, confirmLeave }));

    act(() => {
      result.current.requestLeave();
    });
    await tick();

    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("requestLeave는 확인에서 취소하면 아무 일도 하지 않는다", async () => {
    const onLeave = vi.fn();
    const { result } = renderHook(() =>
      useBackGuard({ onLeave, confirmLeave: () => false }),
    );

    act(() => {
      result.current.requestLeave();
    });
    await tick();

    expect(onLeave).not.toHaveBeenCalled();
    expect(window.history.state).toMatchObject({ backGuard: true });
  });

  it("leaveWith는 확인 없이 가드만 걷어내고 동작을 실행한다", async () => {
    const onLeave = vi.fn();
    const confirmLeave = vi.fn(() => false);
    const action = vi.fn();
    const { result } = renderHook(() => useBackGuard({ onLeave, confirmLeave }));

    act(() => {
      result.current.leaveWith(action);
    });
    await tick();

    expect(action).toHaveBeenCalledTimes(1);
    expect(confirmLeave).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("enabled=false면 가드를 심지 않고 동작만 수행한다", async () => {
    const onLeave = vi.fn();
    const { result } = renderHook(() =>
      useBackGuard({ enabled: false, onLeave }),
    );

    expect(window.history.state).not.toMatchObject({ backGuard: true });

    act(() => {
      result.current.requestLeave();
    });
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
