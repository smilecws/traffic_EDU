import type { WrongNote } from "@/lib/types";
import { getItem, setItem } from "@/lib/utils/storage";

const WRONG_NOTES_KEY = "quiz:wrongNotes";

/** 오답노트 목록을 반환한다 (localStorage). */
export function getWrongNotes(): WrongNote[] {
  return getItem<WrongNote[]>(WRONG_NOTES_KEY, []);
}

/** 오답노트 항목을 추가한다. 같은 questionId가 있으면 최신 정보로 갱신한다. */
export function addWrongNote(note: WrongNote): void {
  const notes = getWrongNotes().filter((n) => n.questionId !== note.questionId);
  notes.push(note);
  setItem(WRONG_NOTES_KEY, notes);
}

/** 해당 questionId의 오답노트 항목을 제거한다. */
export function removeWrongNote(questionId: string): void {
  const notes = getWrongNotes().filter((n) => n.questionId !== questionId);
  setItem(WRONG_NOTES_KEY, notes);
}
