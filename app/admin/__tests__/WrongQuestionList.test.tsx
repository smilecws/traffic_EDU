import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Question } from "@/lib/types";
import type { GroupQuestionStat } from "@/lib/services/adminStatsService";
import { WrongQuestionList } from "@/app/admin/WrongQuestionList";

/** 선택지·정답·해설을 갖춘 문제 하나. */
const question: Question = {
  id: "q342",
  number: 342,
  type: "text",
  question: "신호기 없는 교차로에서의 통행 우선순위는?",
  choices: [
    { id: 1, text: "새로 진입한 차" },
    { id: 2, text: "우측 도로의 차" },
    { id: 3, text: "이미 진입한 차" },
  ],
  answerIds: [3],
  explanation: "교차로 내에 이미 진입한 차가 우선한다.",
};

function stat(overrides: Partial<GroupQuestionStat> = {}): GroupQuestionStat {
  return {
    questionId: "q342",
    number: 342,
    text: question.question,
    bucketLabel: "법규",
    question,
    attempts: 15,
    wrong: 13,
    wrongRate: 0.8667,
    ...overrides,
  };
}

describe("WrongQuestionList", () => {
  it("문항 요약과 오답률을 보여준다", () => {
    render(<WrongQuestionList questions={[stat()]} />);

    // 문제 본문은 한 번만 나온다 — 접힘/펼침이 같은 문단을 쓴다
    expect(
      screen.getAllByText("신호기 없는 교차로에서의 통행 우선순위는?"),
    ).toHaveLength(1);
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.getByText(/342번/)).toBeInTheDocument();
    expect(screen.getByText(/오답 13\/15/)).toBeInTheDocument();
  });

  it("선택지를 모두 펼치고 정답만 표시한다", () => {
    render(<WrongQuestionList questions={[stat()]} />);

    expect(screen.getByText("새로 진입한 차")).toBeInTheDocument();
    expect(screen.getByText("우측 도로의 차")).toBeInTheDocument();
    expect(screen.getByText("이미 진입한 차")).toBeInTheDocument();

    // 정답 표시는 정답 선택지에만 붙는다
    const marks = screen.getAllByLabelText("정답");
    expect(marks).toHaveLength(1);
  });

  it("해설을 보여준다", () => {
    render(<WrongQuestionList questions={[stat()]} />);
    expect(
      screen.getByText("교차로 내에 이미 진입한 차가 우선한다."),
    ).toBeInTheDocument();
  });

  it("문제 데이터를 못 찾은 문항은 안내로 대체한다", () => {
    render(
      <WrongQuestionList
        questions={[stat({ question: null, questionId: "q999" })]}
      />,
    );

    expect(
      screen.getByText(/문제 데이터에서 이 문항을 찾지 못했습니다/),
    ).toBeInTheDocument();
    // 선택지는 그릴 수 없다
    expect(screen.queryByText("이미 진입한 차")).not.toBeInTheDocument();
  });

  it("문항이 없으면 안내 문구를 띄운다", () => {
    render(<WrongQuestionList questions={[]} />);
    expect(
      screen.getByText(/조건을 만족하는 문항이 없습니다/),
    ).toBeInTheDocument();
  });

  it("이미지가 있는 문항은 이미지를 띄운다(사진·상황 유형)", () => {
    render(
      <WrongQuestionList
        questions={[
          stat({
            question: {
              ...question,
              images: ["/questions_images/342.png"],
              imageNotes: ["교차로 진입 상황"],
            },
          }),
        ]}
      />,
    );

    expect(screen.getByAltText("문제 이미지")).toHaveAttribute(
      "src",
      "/questions_images/342.png",
    );
    expect(screen.getByText(/교차로 진입 상황/)).toBeInTheDocument();
  });
});
