import { describe, it, expect } from "vitest";
import { validateName } from "@/lib/utils/validateName";

describe("validateName", () => {
  it("한글 이름을 허용하고 trim한다", () => {
    const res = validateName("  홍길동  ");
    expect(res).toEqual({ ok: true, value: "홍길동" });
  });

  it("영문 이름을 허용한다", () => {
    expect(validateName("John")).toEqual({ ok: true, value: "John" });
  });

  it("공백을 포함한 이름을 허용하고 연속 공백을 하나로 축약한다", () => {
    expect(validateName("홍   길동")).toEqual({ ok: true, value: "홍 길동" });
    expect(validateName("John   Doe")).toEqual({ ok: true, value: "John Doe" });
  });

  it("정확히 2자/30자 경계를 허용한다", () => {
    expect(validateName("가나")).toEqual({ ok: true, value: "가나" });
    const thirty = "가".repeat(30);
    expect(validateName(thirty)).toEqual({ ok: true, value: thirty });
  });

  it("빈 문자열/공백만은 거부한다", () => {
    expect(validateName("")).toMatchObject({ ok: false });
    expect(validateName("   ")).toMatchObject({ ok: false });
  });

  it("1자는 거부한다", () => {
    expect(validateName("가")).toMatchObject({ ok: false });
    expect(validateName("a")).toMatchObject({ ok: false });
  });

  it("숫자만은 거부한다", () => {
    expect(validateName("12345")).toMatchObject({ ok: false });
  });

  it("특수기호만은 거부한다", () => {
    expect(validateName("!@#$%")).toMatchObject({ ok: false });
  });

  it("31자는 거부한다", () => {
    expect(validateName("가".repeat(31))).toMatchObject({ ok: false });
  });
});
