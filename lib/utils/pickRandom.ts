/**
 * 배열에서 중복 없이 n개를 랜덤 추출한다.
 * - n이 배열 길이보다 크거나 같으면 (셔플된) 전체를 반환한다.
 * - 원본 배열은 변경하지 않는다 (불변).
 */
export function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  // Fisher–Yates 셔플 (복사본에 대해서만 수행 → 원본 불변)
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  if (n >= copy.length) return copy;
  if (n <= 0) return [];
  return copy.slice(0, n);
}
