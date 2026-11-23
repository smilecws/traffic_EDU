import { beforeEach, describe, expect, it } from "vitest";
import {
  getAdminBranch,
  getIssuedCodes,
  issueGroupCode,
  normalizeBranchSlug,
  normalizeGroupCode,
  saveAdminBranch,
  saveIssuedCode,
} from "@/lib/services/groupCodeService";

beforeEach(() => {
  window.localStorage.clear();
});

describe("normalizeBranchSlug", () => {
  it("한글 지역명을 로마자 슬러그로 바꾼다", () => {
    expect(normalizeBranchSlug("서울")).toBe("seoul");
    expect(normalizeBranchSlug("춘천")).toBe("chuncheon");
  });

  it("지역명이 더 긴 문구에 들어 있어도 찾아낸다", () => {
    expect(normalizeBranchSlug("춘천교육장")).toBe("chuncheon");
    expect(normalizeBranchSlug("서울 2반")).toBe("seoul");
  });

  it("영문 입력은 소문자 슬러그로 정리한다", () => {
    expect(normalizeBranchSlug("  Gimpo  ")).toBe("gimpo");
    expect(normalizeBranchSlug("Branch_2 North")).toBe("branch-2-north");
  });

  it("슬러그를 15자로 자른다 (코드 전체 24자 제한)", () => {
    expect(normalizeBranchSlug("a".repeat(40))).toBe("a".repeat(15));
  });

  it("잘라낸 뒤 끝에 남는 하이픈을 없앤다", () => {
    // 15자에서 잘리면 "aaaaaaaaaaaaaa-" 가 되는 입력
    expect(normalizeBranchSlug(`${"a".repeat(14)} bbb`)).toBe("a".repeat(14));
  });

  it("슬러그를 만들 수 없으면 null", () => {
    expect(normalizeBranchSlug("")).toBeNull();
    expect(normalizeBranchSlug("   ")).toBeNull();
    // 표에 없는 한글은 남는 글자가 없다
    expect(normalizeBranchSlug("가평")).toBeNull();
  });
});

describe("issueGroupCode", () => {
  const nov24 = new Date(2026, 10, 24, 9, 0, 0);

  it("MMDD-지점-랜덤3자 형태로 발급한다", () => {
    const code = issueGroupCode("춘천", nov24);
    expect(code).toMatch(/^1124-chuncheon-[a-z0-9]{3}$/);
  });

  it("월·일을 0으로 채운다", () => {
    const code = issueGroupCode("서울", new Date(2026, 0, 5, 9, 0, 0));
    expect(code).toMatch(/^0105-seoul-/);
  });

  it("발급된 코드는 항상 코드 형식 검증을 통과한다", () => {
    const code = issueGroupCode("a".repeat(40), nov24);
    expect(code).not.toBeNull();
    expect(normalizeGroupCode(code as string)).toBe(code);
    expect((code as string).length).toBeLessThanOrEqual(24);
  });

  it("같은 지점·같은 날이어도 서로 다른 코드가 나온다", () => {
    const codes = new Set(
      Array.from({ length: 50 }, () => issueGroupCode("서울", nov24)),
    );
    // 랜덤 접미사(31^3 = 29,791가지) — 50회 중 중복은 사실상 없다
    expect(codes.size).toBeGreaterThan(45);
  });

  it("지점을 알아볼 수 없으면 null", () => {
    expect(issueGroupCode("", nov24)).toBeNull();
  });
});

describe("발급 내역", () => {
  it("최신순으로 쌓인다", () => {
    saveIssuedCode({ code: "1124-seoul-aaa", branch: "서울", issuedAt: 1 });
    saveIssuedCode({ code: "1124-chuncheon-bbb", branch: "춘천", issuedAt: 2 });
    expect(getIssuedCodes().map((e) => e.code)).toEqual([
      "1124-chuncheon-bbb",
      "1124-seoul-aaa",
    ]);
  });

  it("같은 코드는 중복 저장하지 않는다", () => {
    saveIssuedCode({ code: "1124-seoul-aaa", branch: "서울", issuedAt: 1 });
    saveIssuedCode({ code: "1124-seoul-aaa", branch: "서울", issuedAt: 5 });
    const list = getIssuedCodes();
    expect(list).toHaveLength(1);
    expect(list[0].issuedAt).toBe(5);
  });

  it("20건까지만 보관한다", () => {
    for (let i = 0; i < 25; i += 1) {
      saveIssuedCode({ code: `1124-seoul-a${i}`, branch: "서울", issuedAt: i });
    }
    expect(getIssuedCodes()).toHaveLength(20);
  });

  it("깨진 항목은 걸러낸다", () => {
    window.localStorage.setItem(
      "quiz:adminIssuedCodes",
      JSON.stringify([{ code: "ok", branch: "x", issuedAt: 1 }, null, { x: 1 }]),
    );
    expect(getIssuedCodes()).toHaveLength(1);
  });
});

describe("지점 기억", () => {
  it("마지막 입력값을 되읽는다", () => {
    expect(getAdminBranch()).toBe("");
    saveAdminBranch("  춘천 ");
    expect(getAdminBranch()).toBe("춘천");
  });
});
