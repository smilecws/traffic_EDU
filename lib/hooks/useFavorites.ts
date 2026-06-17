"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFavorites, toggleFavorite } from "@/lib/services/favoriteService";

const FAVORITES_KEY = ["favorites"];

/**
 * 즐겨찾기 목록 조회 + 토글.
 * - favoriteService(localStorage)만 사용. addedAt은 hook에서 주입.
 * - 토글(mutation) 후 invalidate로 갱신.
 */
export function useFavorites() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: FAVORITES_KEY,
    queryFn: () => getFavorites(),
  });

  const toggle = useMutation({
    mutationFn: async (questionId: string) =>
      toggleFavorite(questionId, Date.now()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });

  return {
    ...query,
    toggleFavorite: toggle.mutate,
  };
}
