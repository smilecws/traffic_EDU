import type { QuestionResult } from "@/lib/types";
import { getDb } from "@/lib/firebase";

/**
 * 익명 답안 로그를 Firestore `answer_logs` 컬렉션에 세션당 문서 1개로 기록한다.
 *
 * - 오답률(%) 산출용으로 **전체 시도(정답·오답)** 를 기록한다.
 * - **실제로 답한 문제만** 기록한다(미응답=빈 selectedIds 제외). 모의고사 시간초과로
 *   채워진 미응답은 실제 시도가 아니므로 오답률 분모에서 빠져야 정확하다.
 * - 개인 식별 정보(uid/이메일/이름)·selectedIds는 절대 포함하지 않는다.
 *   문제별 정/오답(q,c)과 서버 타임스탬프만 기록한다.
 * - Firestore 미설정/오프라인이어도 앱이 죽지 않도록 실패를 삼킨다 (best-effort).
 */
export async function logAnswers(results: QuestionResult[]): Promise<void> {
  const answered = results.filter((r) => r.selectedIds.length > 0);
  if (answered.length === 0) return;
  try {
    const db = getDb();
    if (!db) return; // Firebase 미설정 — 집계는 best-effort이므로 조용히 종료

    const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    await addDoc(collection(db, "answer_logs"), {
      items: answered.map((r) => ({ q: r.questionId, c: r.correct })),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Firestore 실패는 무시 — 익명 집계는 best-effort, 앱 흐름을 막지 않는다
  }
}
