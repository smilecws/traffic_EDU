import { describe, it, expect } from "vitest";
import { pickRandom } from "@/lib/utils/pickRandom";

describe("pickRandom", () => {
  const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("요청한 개수만큼 반환한다", () => {
    expect(pickRandom(source, 3)).toHaveLength(3);
    expect(pickRandom(source, 5)).toHaveLength(5);
  });

  it("중복 없이 추출한다", () => {
    const picked = pickRandom(source, 5);
    expect(new Set(picked).size).toBe(picked.length);
  });

  it("추출된 값은 모두 원본에 존재한다", () => {
    const picked = pickRandom(source, 4);
    for (const x of picked) {
      expect(source).toContain(x);
    }
  });

  it("원본 배열을 변경하지 않는다 (불변)", () => {
    const before = [...source];
    pickRandom(source, 3);
    expect(source).toEqual(before);
  });

  it("n이 길이보다 크면 전체를 반환한다", () => {
    const picked = pickRandom(source, 100);
    expect(picked).toHaveLength(source.length);
    expect(new Set(picked)).toEqual(new Set(source));
  });

  it("n이 길이와 같으면 전체를 반환한다", () => {
    expect(pickRandom(source, source.length)).toHaveLength(source.length);
  });

  it("n이 0 이하이면 빈 배열을 반환한다", () => {
    expect(pickRandom(source, 0)).toEqual([]);
    expect(pickRandom(source, -1)).toEqual([]);
  });
});
