import { beforeEach, describe, expect, it } from "vitest";
import {
  buildGroupLink,
  captureGroupCodeFromSearch,
  clearGroupCode,
  endOfToday,
  getGroupCode,
  normalizeGroupCode,
  saveGroupCode,
} from "@/lib/services/groupCodeService";

beforeEach(() => {
  window.localStorage.clear();
});

describe("normalizeGroupCode", () => {
  it("공백을 제거하고 소문자로 바꾼다", () => {
    expect(normalizeGroupCode("  1124A  ")).toBe("1124a");
  });

  it("하이픈을 허용한다", () => {
    expect(normalizeGroupCode("2026-11-24-am")).toBe("2026-11-24-am");
  });

  it("허용되지 않는 문자·길이는 거부한다", () => {
    expect(normalizeGroupCode("")).toBeNull();
    expect(normalizeGroupCode("1124 a")).toBeNull();
    expect(normalizeGroupCode("홍길동반")).toBeNull();
    expect(normalizeGroupCode("a_b")).toBeNull();
    expect(normalizeGroupCode("a".repeat(25))).toBeNull();
  });
});

describe("saveGroupCode / getGroupCode", () => {
  it("저장한 코드를 되읽는다", () => {
    saveGroupCode("1124A");
    expect(getGroupCode()).toBe("1124a");
  });

  it("형식에 맞지 않으면 저장하지 않는다", () => {
    saveGroupCode("bad code");
    expect(getGroupCode()).toBeNull();
  });

  it("만료된 코드는 무효로 보고 정리한다", () => {
    saveGroupCode("1124a", Date.now() - 1);
    expect(getGroupCode()).toBeNull();
    expect(window.localStorage.getItem("quiz:groupCode")).toBeNull();
  });

  it("clearGroupCode로 해제된다", () => {
    saveGroupCode("1124a");
    clearGroupCode();
    expect(getGroupCode()).toBeNull();
  });

  it("기본 만료는 당일 자정이다", () => {
    saveGroupCode("1124a");
    const raw = window.localStorage.getItem("quiz:groupCode");
    expect(raw).not.toBeNull();
    const entry = JSON.parse(raw as string) as { expiresAt: number };
    expect(entry.expiresAt).toBe(endOfToday());
  });
});

describe("captureGroupCodeFromSearch", () => {
  it("?g= 값을 읽어 저장한다", () => {
    expect(captureGroupCodeFromSearch("?g=1124a&x=1")).toBe("1124a");
    expect(getGroupCode()).toBe("1124a");
  });

  it("코드가 없으면 아무것도 저장하지 않는다", () => {
    expect(captureGroupCodeFromSearch("?x=1")).toBeNull();
    expect(getGroupCode()).toBeNull();
  });

  it("형식이 틀린 코드는 무시한다", () => {
    expect(captureGroupCodeFromSearch("?g=%EB%B0%98")).toBeNull();
    expect(getGroupCode()).toBeNull();
  });
});

describe("buildGroupLink", () => {
  it("origin 뒤에 ?g= 쿼리를 붙인다", () => {
    expect(buildGroupLink("https://example.com", "1124a")).toBe(
      "https://example.com/?g=1124a",
    );
  });

  it("origin 끝의 슬래시가 중복되지 않는다", () => {
    expect(buildGroupLink("https://example.com/", "1124a")).toBe(
      "https://example.com/?g=1124a",
    );
  });

  it("코드가 올바르지 않으면 origin을 그대로 돌려준다", () => {
    expect(buildGroupLink("https://example.com", "bad code")).toBe(
      "https://example.com",
    );
  });
});
