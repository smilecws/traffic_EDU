import type { Favorite } from "@/lib/types";
import { getItem, setItem } from "@/lib/utils/storage";

const FAVORITES_KEY = "quiz:favorites";

/** 즐겨찾기 목록을 반환한다 (localStorage). */
export function getFavorites(): Favorite[] {
  return getItem<Favorite[]>(FAVORITES_KEY, []);
}

/** 해당 문제가 즐겨찾기 되어 있는지 여부. */
export function isFavorite(questionId: string): boolean {
  return getFavorites().some((f) => f.questionId === questionId);
}

/**
 * 즐겨찾기 상태를 토글한다.
 * @param addedAt 추가 시각 — 호출측에서 주입 (기본값 0, 결정성 유지)
 */
export function toggleFavorite(questionId: string, addedAt = 0): void {
  const favorites = getFavorites();
  const exists = favorites.some((f) => f.questionId === questionId);
  if (exists) {
    setItem(
      FAVORITES_KEY,
      favorites.filter((f) => f.questionId !== questionId),
    );
  } else {
    setItem(FAVORITES_KEY, [...favorites, { questionId, addedAt }]);
  }
}
