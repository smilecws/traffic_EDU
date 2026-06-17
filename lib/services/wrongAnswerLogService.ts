import type { WrongAnswerLog } from "@/lib/types";
import { getDb } from "@/lib/firebase";

/**
 * 익명 오답 로그를 Firestore `wrong_answer_logs` 컬렉션에 기록한다.
 *
 * - 개인 식별 정보(uid/이메일/이름)는 절대 포함하지 않는다.
 *   questionId, selectedIds, 서버 타임스탬프만 기록한다.
 * - Firestore 미설정/오프라인이어도 앱이 죽지 않도록 실패를 삼킨다 (best-effort).
 */
export async function logWrongAnswers(logs: WrongAnswerLog[]): Promise<void> {
  if (logs.length === 0) return;
  try {
    const db = getDb();
    if (!db) return; // Firebase 미설정 — 집계는 best-effort이므로 조용히 종료

    const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    const colRef = collection(db, "wrong_answer_logs");

    await Promise.all(
      logs.map((log) =>
        addDoc(colRef, {
          questionId: log.questionId,
          selectedIds: log.selectedIds,
          createdAt: serverTimestamp(),
        }),
      ),
    );
  } catch {
    // Firestore 실패는 무시 — 익명 집계는 best-effort, 앱 흐름을 막지 않는다
  }
}
