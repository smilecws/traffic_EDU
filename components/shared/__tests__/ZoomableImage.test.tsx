import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ZoomableImage } from "@/components/shared/ZoomableImage";

/**
 * 문제 이미지 확대 — 사진·상황 문제는 원본이 축소돼 세부가 안 보이는 경우가 있어
 * 눌러서 전체 화면으로 키울 수 있어야 한다. 키보드/ESC로도 빠져나와야 하고,
 * 닫은 뒤 본문 스크롤이 잠긴 채로 남지 않아야 한다.
 */

describe("ZoomableImage", () => {
  it("이미지를 누르면 확대 화면이 열린다", () => {
    render(<ZoomableImage src="/questions_images/342.png" alt="문제 이미지" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "문제 이미지 확대" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // 축소 이미지와 확대 이미지 둘 다 같은 원본을 가리킨다.
    expect(screen.getAllByAltText("문제 이미지")).toHaveLength(2);
  });

  it("확대 화면에서 이미지를 누르면 원본 크기 ↔ 화면 맞춤이 전환된다", () => {
    render(<ZoomableImage src="/questions_images/342.png" alt="문제 이미지" />);
    fireEvent.click(screen.getByRole("button", { name: "문제 이미지 확대" }));

    const toActual = screen.getByRole("button", { name: "원본 크기로 보기" });
    fireEvent.click(toActual);

    expect(
      screen.getByRole("button", { name: "화면 크기에 맞추기" }),
    ).toBeInTheDocument();
  });

  it("닫기 버튼·배경 클릭·ESC로 닫히고 본문 스크롤 잠금이 풀린다", () => {
    render(<ZoomableImage src="/questions_images/342.png" alt="문제 이미지" />);
    const open = () =>
      fireEvent.click(screen.getByRole("button", { name: "문제 이미지 확대" }));

    open();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "확대 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");

    open();
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    open();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
