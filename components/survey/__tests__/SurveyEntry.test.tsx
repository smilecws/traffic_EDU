import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { saveGroupCode } from "@/lib/services/groupCodeService";
import {
  clearSurveyState,
  markSurveyDone,
  setSurveyForCode,
} from "@/lib/services/surveyService";
import { SurveyEntry } from "@/components/survey/SurveyEntry";

/**
 * 홈 화면 입구의 세 가지 상태 — 안 보임 / 참여 가능 / 응답 완료.
 * 설문이 꺼진 회차와 일반 사용자에게 버튼이 새어 나가지 않는지가 핵심이다.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  window.localStorage.clear();
  clearSurveyState();
  push.mockClear();
});

/**
 * 설문이 켜진 회차 QR로 막 들어온 상태를 만든다.
 * 설문을 켜는 주체는 서버다 — `GroupCodeCapture`가 `/api/session`의 답을
 * `setSurveyForCode`로 넘긴다. 여기서는 그 답이 도착한 상태를 흉내 낸다.
 */
function enterWithSurvey(code = "1124-chuncheon-7k2") {
  saveGroupCode(code);
  setSurveyForCode(code, true);
  return code;
}

describe("SurveyEntry", () => {
  it("설문이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<SurveyEntry />);
    expect(container).toBeEmptyDOMElement();
  });

  it("설문이 꺼진 회차에서도 그리지 않는다", () => {
    saveGroupCode("1124-chuncheon-7k2");
    const { container } = render(<SurveyEntry />);
    expect(container).toBeEmptyDOMElement();
  });

  it("설문이 켜진 회차에서는 조사 버튼을 띄운다", () => {
    enterWithSurvey();
    render(<SurveyEntry />);
    expect(
      screen.getByRole("button", { name: /교육 만족도 조사/ }),
    ).toBeInTheDocument();
  });

  it("버튼을 누르면 설문 화면으로 보낸다", () => {
    enterWithSurvey();
    render(<SurveyEntry />);
    screen.getByRole("button", { name: /교육 만족도 조사/ }).click();
    expect(push).toHaveBeenCalledWith("/survey");
  });

  it("응답을 마치면 버튼 대신 완료 표시가 남는다", () => {
    const code = enterWithSurvey();
    markSurveyDone(code);
    render(<SurveyEntry />);

    expect(screen.getByText("이미 조사에 응답하셨습니다")).toBeInTheDocument();
    // 사라지지 않고 남되, 다시 누를 수는 없어야 한다.
    expect(screen.queryByRole("button")).toBeNull();
  });
});
