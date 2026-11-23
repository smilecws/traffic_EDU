import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { saveGroupCode, clearGroupCode } from "@/lib/services/groupCodeService";
import {
  clearAssignment,
  setAssignmentForCode,
} from "@/lib/services/assignmentService";
import { AssignmentEntry } from "@/components/assignment/AssignmentEntry";

/**
 * 홈 화면 "이번 교육 문제" 입구 — 안 보임 / 보임 두 가지 상태.
 * 지정 출제가 없는 회차와 일반 사용자에게 카드가 새어 나가지 않는지가 핵심이다.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  window.localStorage.clear();
  clearGroupCode();
  clearAssignment();
  push.mockClear();
});

/**
 * 지정 출제가 있는 회차 QR로 막 들어온 상태를 만든다.
 * 무엇을 출제할지 정하는 주체는 서버다 — `GroupCodeCapture`가 `/api/session`의
 * 답을 `setAssignmentForCode`로 넘긴다. 여기서는 그 답이 도착한 상태를 흉내 낸다.
 */
function enterWithAssignment(picks: string[], code = "1124-chuncheon-7k2") {
  saveGroupCode(code);
  setAssignmentForCode(code, picks);
  return code;
}

describe("AssignmentEntry", () => {
  it("지정 출제가 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<AssignmentEntry />);
    expect(container).toBeEmptyDOMElement();
  });

  it("회차 QR로 들어왔지만 지정이 없으면 그리지 않는다", () => {
    saveGroupCode("1124-chuncheon-7k2");
    const { container } = render(<AssignmentEntry />);
    expect(container).toBeEmptyDOMElement();
  });

  it("지정된 회차에서는 문제 수와 함께 카드를 띄운다", () => {
    enterWithAssignment(["12", "45", "101"]);
    render(<AssignmentEntry />);

    expect(
      screen.getByRole("button", { name: /이번 교육 문제/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/3문제/)).toBeInTheDocument();
  });

  it("카드를 누르면 지정 출제 모드로 보낸다", () => {
    enterWithAssignment(["12"]);
    render(<AssignmentEntry />);
    screen.getByRole("button", { name: /이번 교육 문제/ }).click();
    expect(push).toHaveBeenCalledWith("/quiz/play?mode=assigned");
  });

  it("다른 회차 QR로 다시 들어오면 지난 교육 문제를 보여 주지 않는다", () => {
    enterWithAssignment(["12", "45"]);
    saveGroupCode("1125-seoul-aaaaaa");
    const { container } = render(<AssignmentEntry />);
    expect(container).toBeEmptyDOMElement();
  });
});
