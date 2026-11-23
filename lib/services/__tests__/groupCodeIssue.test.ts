import { beforeEach, describe, expect, it } from "vitest";
import {
  BRANCH_MAX_LENGTH,
  getAdminBranch,
  issueGroupCode,
  normalizeBranchName,
  normalizeGroupCode,
  saveAdminBranch,
} from "@/lib/services/groupCodeService";

/**
 * 코드 생성 규칙 — 서버(`/api/admin/sessions`)와 브라우저가 공유한다.
 * 여기서는 `groupCodeService`를 통해 부르는데, 재export가 끊기면 발급 화면이
 * 통째로 깨지므로 그 경로까지 함께 지킨다.
 *
 * 이 파일이 지키는 핵심은 **코드에 이름이 섞이지 않는다**는 것이다. 예전에는
 * 교육반 이름을 로마자로 바꿔 코드에 심었고, 그래서 표에 없는 한글 이름은
 * 발급 자체가 막혔다. 이름은 등록부에만 적고 코드는 이름과 무관하게 만든다.
 */

beforeEach(() => {
  window.localStorage.clear();
});

describe("issueGroupCode", () => {
  /** KST 2026-11-24 10:00 — 시간대와 무관하게 같은 순간을 가리킨다. */
  const nov24 = new Date(Date.UTC(2026, 10, 24, 1, 0, 0));

  it("MMDD-랜덤6자 형태로 발급한다", () => {
    expect(issueGroupCode(nov24)).toMatch(/^1124-[a-z0-9]{6}$/);
  });

  it("월·일을 0으로 채운다", () => {
    expect(issueGroupCode(new Date(Date.UTC(2026, 0, 5, 1, 0, 0)))).toMatch(
      /^0105-/,
    );
  });

  it("날짜는 KST로 읽는다 — 서버가 UTC로 돌아도 교육일과 어긋나지 않는다", () => {
    // UTC 11-24 22:00 = KST 11-25 07:00. 서버 로컬(UTC)로 읽으면 1124가 된다.
    expect(issueGroupCode(new Date(Date.UTC(2026, 10, 24, 22, 0, 0)))).toMatch(
      /^1125-/,
    );
  });

  it("발급된 코드는 항상 코드 형식 검증을 통과한다", () => {
    const code = issueGroupCode(nov24);
    expect(normalizeGroupCode(code)).toBe(code);
    expect(code.length).toBeLessThanOrEqual(24);
  });

  it("같은 날이어도 서로 다른 코드가 나온다", () => {
    const codes = new Set(
      Array.from({ length: 200 }, () => issueGroupCode(nov24)),
    );
    // 31^6 ≈ 8.9억 가지 — 200회 중 중복은 사실상 없다
    expect(codes.size).toBe(200);
  });

  it("헷갈리는 글자(0·o·1·l·i)는 쓰지 않는다", () => {
    const suffixes = Array.from({ length: 100 }, () =>
      issueGroupCode(nov24).split("-")[1],
    ).join("");
    expect(suffixes).not.toMatch(/[01oli]/);
  });
});

describe("normalizeBranchName", () => {
  it("표에 없는 한글도 그대로 받는다 — 이름에 제한이 없다", () => {
    expect(normalizeBranchName("법규위반반")).toBe("법규위반반");
    expect(normalizeBranchName("홍길동 교수자")).toBe("홍길동 교수자");
  });

  it("비어 있어도 된다 — 이름은 선택이다", () => {
    expect(normalizeBranchName("")).toBe("");
    expect(normalizeBranchName("   ")).toBe("");
  });

  it("공백을 접고 양끝을 다듬는다", () => {
    expect(normalizeBranchName("  음주반   2교시 ")).toBe("음주반 2교시");
  });

  it("제어문자를 공백으로 바꾼다", () => {
    expect(normalizeBranchName("음주\u0000반")).toBe("음주 반");
  });

  it("상한 길이로 자른다", () => {
    expect(normalizeBranchName("가".repeat(100))).toHaveLength(
      BRANCH_MAX_LENGTH,
    );
  });
});

describe("이름 기억", () => {
  it("마지막 입력값을 되읽는다", () => {
    expect(getAdminBranch()).toBe("");
    saveAdminBranch("  음주반 ");
    expect(getAdminBranch()).toBe("음주반");
  });
});
