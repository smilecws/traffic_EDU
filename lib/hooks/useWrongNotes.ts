"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WrongNote } from "@/lib/types";
import {
  addWrongNote,
  getWrongNotes,
  removeWrongNote,
} from "@/lib/services/wrongNoteService";

const WRONG_NOTES_KEY = ["wrongNotes"];

/**
 * 오답노트 목록 조회 + 추가/삭제.
 * - wrongNoteService(localStorage)만 사용. mutation 후 invalidate로 갱신.
 */
export function useWrongNotes() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: WRONG_NOTES_KEY });

  const query = useQuery({
    queryKey: WRONG_NOTES_KEY,
    queryFn: () => getWrongNotes(),
  });

  const add = useMutation({
    mutationFn: async (note: WrongNote) => addWrongNote(note),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (questionId: string) => removeWrongNote(questionId),
    onSuccess: invalidate,
  });

  return {
    ...query,
    addWrongNote: add.mutate,
    removeWrongNote: remove.mutate,
  };
}
