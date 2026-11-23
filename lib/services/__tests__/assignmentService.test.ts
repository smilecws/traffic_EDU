import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAssignment,
  getAssignment,
  getAssignmentPicks,
  getAssignmentStateSnapshot,
  setAssignmentForCode,
} from "@/lib/services/assignmentService";
import { saveGroupCode, clearGroupCode } from "@/lib/services/groupCodeService";

const CODE = "1124-7k2m9p";

describe("assignmentService", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearGroupCode();
    clearAssignment();
    saveGroupCode(CODE);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("서버가 준 목록을 저장하고 읽는다", () => {
    setAssignmentForCode(CODE, ["12", "45", "3"]);
    expect(getAssignment()).toEqual({ code: CODE, picks: ["12", "45", "3"] });
    // 순서가 출제 순서다 — 정렬하지 않는다.
    expect(getAssignmentPicks()).toEqual(["12", "45", "3"]);
  });

  it("빈 목록이 오면 기존 기록을 지운다(지정을 끈 회차)", () => {
    setAssignmentForCode(CODE, ["12"]);
    setAssignmentForCode(CODE, []);
    expect(getAssignment()).toBeNull();
  });

  it("형식이 깨진 값은 걸러낸다", () => {
    setAssignmentForCode(CODE, ["12", "abc", 0, null, "13"]);
    expect(getAssignmentPicks()).toEqual(["12", "13"]);
  });

  it("저장된 회차 코드와 다르면 무시한다(다른 QR로 재진입)", () => {
    setAssignmentForCode(CODE, ["12"]);
    saveGroupCode("1125-aaaaaa");
    expect(getAssignment()).toBeNull();
  });

  it("회차 코드가 풀리면(자정 경과) 무시한다", () => {
    setAssignmentForCode(CODE, ["12"]);
    clearGroupCode();
    expect(getAssignment()).toBeNull();
  });

  it("만료 시각이 지나면 기록을 버린다", () => {
    setAssignmentForCode(CODE, ["12"]);
    // 자정까지가 수명이므로 이틀 뒤로 밀면 반드시 만료된다.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60 * 1000);
    expect(getAssignment()).toBeNull();
  });

  it("홈 화면 스냅샷은 값이 같으면 같은 참조를 돌려준다", () => {
    setAssignmentForCode(CODE, ["12", "13"]);
    const first = getAssignmentStateSnapshot();
    expect(first).toEqual({ code: CODE, count: 2 });
    expect(getAssignmentStateSnapshot()).toBe(first);
  });

  it("지정이 없으면 스냅샷이 비어 있다", () => {
    expect(getAssignmentStateSnapshot()).toEqual({ code: null, count: 0 });
  });
});
