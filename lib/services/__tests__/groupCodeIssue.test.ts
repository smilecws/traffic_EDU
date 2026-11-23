import { beforeEach, describe, expect, it } from "vitest";
import {
  getAdminBranch,
  issueGroupCode,
  normalizeBranchSlug,
  normalizeGroupCode,
  saveAdminBranch,
} from "@/lib/services/groupCodeService";

/**
 * 코드 생성 규칙 — 서버(`/api/admin/sessions`)와 브라우저가 공유한다.
 * 여기서는 `groupCodeService`를 통해 부르는데, 재export가 끊기면 발급 화면이
 * 통째로 깨지므로 그 경로까지 함께 지킨다.
 */

beforeEach(() => {
  window.localStorage.clear();
});

describe("normalizeBranchSlug", () => {
  it("한글 교육반 이름을 로마자 슬러그로 바꾼다", () => {
    expect(normalizeBranchSlug("음주")).toBe("eumju");
    expect(normalizeBranchSlug("교수자")).toBe("gyosuja");
  });

  it("한글 지역명도 그대로 받는다", () => {
    expect(normalizeBranchSlug("서울")).toBe("seoul");
    expect(normalizeBranchSlug("춘천")).toBe("chuncheon");
  });

  it("이름이 더 긴 문구에 들어 있어도 찾아낸다", () => {
    expect(normalizeBranchSlug("춘천교육장")).toBe("chuncheon");
    expect(normalizeBranchSlug("음주 2반")).toBe("eumju");
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
  /** KST 2026-11-24 10:00 — 시간대와 무관하게 같은 순간을 가리킨다. */
  const nov24 = new Date(Date.UTC(2026, 10, 24, 1, 0, 0));

  it("MMDD-교육반-랜덤3자 형태로 발급한다", () => {
    expect(issueGroupCode("음주", nov24)).toMatch(/^1124-eumju-[a-z0-9]{3}$/);
  });

  it("월·일을 0으로 채운다", () => {
    const code = issueGroupCode("서울", new Date(Date.UTC(2026, 0, 5, 1, 0, 0)));
    expect(code).toMatch(/^0105-seoul-/);
  });

  it("날짜는 KST로 읽는다 — 서버가 UTC로 돌아도 교육일과 어긋나지 않는다", () => {
    // UTC 11-24 22:00 = KST 11-25 07:00. 서버 로컬(UTC)로 읽으면 1124가 된다.
    const earlyMorning = new Date(Date.UTC(2026, 10, 24, 22, 0, 0));
    expect(issueGroupCode("음주", earlyMorning)).toMatch(/^1125-eumju-/);
  });

  it("발급된 코드는 항상 코드 형식 검증을 통과한다", () => {
    const code = issueGroupCode("a".repeat(40), nov24);
    expect(code).not.toBeNull();
    expect(normalizeGroupCode(code as string)).toBe(code);
    expect((code as string).length).toBeLessThanOrEqual(24);
  });

  it("같은 교육반·같은 날이어도 서로 다른 코드가 나온다", () => {
    const codes = new Set(
      Array.from({ length: 50 }, () => issueGroupCode("음주", nov24)),
    );
    // 랜덤 접미사(31^3 = 29,791가지) — 50회 중 중복은 사실상 없다
    expect(codes.size).toBeGreaterThan(45);
  });

  it("교육반을 알아볼 수 없으면 null", () => {
    expect(issueGroupCode("", nov24)).toBeNull();
  });
});

describe("교육반 기억", () => {
  it("마지막 입력값을 되읽는다", () => {
    expect(getAdminBranch()).toBe("");
    saveAdminBranch("  음주 ");
    expect(getAdminBranch()).toBe("음주");
  });
});
