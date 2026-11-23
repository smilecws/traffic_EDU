import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  createSessionValue,
  isAdminConfigured,
  verifyPassword,
  verifySessionValue,
} from "@/lib/server/adminAuth";

const ORIGINAL = process.env.ADMIN_PASSWORD;

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "교육pass-1234";
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = ORIGINAL;
});

describe("isAdminConfigured", () => {
  it("비밀번호가 있으면 true", () => {
    expect(isAdminConfigured()).toBe(true);
  });

  it("비밀번호가 없으면 false", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(isAdminConfigured()).toBe(false);
  });
});

describe("verifyPassword", () => {
  it("정확히 일치할 때만 통과한다", () => {
    expect(verifyPassword("교육pass-1234")).toBe(true);
    expect(verifyPassword("교육pass-123")).toBe(false);
    expect(verifyPassword("")).toBe(false);
    expect(verifyPassword("교육PASS-1234")).toBe(false);
  });

  it("비밀번호 미설정이면 어떤 입력도 거부한다", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(verifyPassword("")).toBe(false);
    expect(verifyPassword("교육pass-1234")).toBe(false);
  });
});

describe("createSessionValue / verifySessionValue", () => {
  it("발급한 세션은 유효하다", () => {
    const value = createSessionValue();
    expect(value).not.toBeNull();
    expect(verifySessionValue(value as string)).toBe(true);
  });

  it("만료 후에는 무효다", () => {
    const now = Date.now();
    const value = createSessionValue(now) as string;
    const afterExpiry = now + (SESSION_TTL_SECONDS + 1) * 1000;
    expect(verifySessionValue(value, afterExpiry)).toBe(false);
  });

  it("빈 값·형식 불일치는 무효다", () => {
    expect(verifySessionValue(undefined)).toBe(false);
    expect(verifySessionValue("")).toBe(false);
    expect(verifySessionValue("abc")).toBe(false);
    expect(verifySessionValue("abc.def")).toBe(false);
  });

  it("만료시각을 늘려도 서명이 맞지 않아 무효다", () => {
    const now = Date.now();
    const value = createSessionValue(now) as string;
    const [, signature] = value.split(".");
    const forged = `${Math.floor(now / 1000) + 99999}.${signature}`;
    expect(verifySessionValue(forged)).toBe(false);
  });

  it("비밀번호를 바꾸면 기존 세션이 전부 무효화된다", () => {
    const value = createSessionValue() as string;
    process.env.ADMIN_PASSWORD = "다른비밀번호-9999";
    expect(verifySessionValue(value)).toBe(false);
  });

  it("비밀번호 미설정이면 세션을 만들 수 없다", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(createSessionValue()).toBeNull();
  });
});
