import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "@/components/shared/PageHeader";
import { markHistoryEntryPoint } from "@/lib/utils/appHistory";

/**
 * ← 버튼은 "한 단계 위로"다. 방문 기록에만 기대면 링크·QR로 바로 들어온 화면에서
 * 사이트 밖으로 나가 버린다(삼성 인터넷은 외부 링크를 쓰던 탭에 열어 그 증상이 보인다).
 * 그래서 앱 안에서 넘어온 기록이 있을 때만 뒤로가기를 쓴다.
 */

const back = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, replace }),
}));

beforeEach(() => {
  back.mockClear();
  replace.mockClear();
});

/** 링크·QR·주소 입력으로 이 화면에 바로 들어온 상태(앱 안 기록 없음). */
function enterDirectly(path: string) {
  window.history.replaceState(null, "", path);
  markHistoryEntryPoint();
}

/** 앱 안에서 한 화면 거쳐 들어온 상태(pushState 한 번). */
function enterFromInsideApp(from: string, to: string) {
  enterDirectly(from);
  window.history.pushState(null, "", to);
}

function pressAppBack() {
  screen.getByLabelText("뒤로 가기").click();
}

describe("PageHeader", () => {
  it("앱 안에서 넘어온 화면에서는 뒤로가기로 왔던 화면에 돌아간다", () => {
    enterFromInsideApp("/", "/quiz");
    render(<PageHeader title="문제 풀기" />);

    pressAppBack();

    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("바로 진입한 화면에서는 기록 대신 상위 화면으로 간다", () => {
    enterDirectly("/quiz");
    render(<PageHeader title="문제 풀기" />);

    pressAppBack();

    expect(replace).toHaveBeenCalledWith("/");
    expect(back).not.toHaveBeenCalled();
  });

  it("바로 진입한 하위 화면은 지정된 상위 경로로 간다", () => {
    enterDirectly("/quiz/history");
    render(<PageHeader title="모의고사 이력" parentHref="/quiz" />);

    pressAppBack();

    expect(replace).toHaveBeenCalledWith("/quiz");
  });

  it("onBack을 넘기면 그 동작을 그대로 쓴다(가드 경유)", () => {
    enterDirectly("/quiz/play");
    const onBack = vi.fn();
    render(<PageHeader title="모의고사" onBack={onBack} />);

    pressAppBack();

    expect(back).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
