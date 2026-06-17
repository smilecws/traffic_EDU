import { getDb, getAuthInstance } from "@/lib/firebase";
import {
  ensureAnonymousSignIn,
  getCurrentUid,
} from "@/lib/services/authService";

/**
 * 동의가 끝난 사용자의 이름을 `app_users/{uid}`에만 기록한다.
 *
 * - **반드시 동의 완료 후에만 호출한다**(호출측 책임).
 * - uid는 익명 인증으로 확보한다. 확보 실패 시 조용히 종료(best-effort).
 * - 문서 형태는 `{ name, createdAt }`로 한정한다(보안 규칙과 일치).
 * - `app_users` 외 어떤 컬렉션(특히 `wrong_answer_logs`)에도 이름을 쓰지 않는다.
 * - 실패는 throw하지 않고 삼킨다(best-effort).
 */
export async function registerUser(name: string): Promise<void> {
  try {
    const uid = await ensureAnonymousSignIn();
    if (!uid) return; // uid 확보 실패 — best-effort이므로 조용히 종료

    const db = getDb();
    if (!db) return; // Firebase 미설정 — 조용히 종료

    const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
    await setDoc(
      doc(db, "app_users", uid),
      { name, createdAt: serverTimestamp() },
      { merge: true },
    );

    // 표시용 displayName도 함께 갱신(선택, best-effort).
    const currentUser = getAuthInstance()?.currentUser;
    if (currentUser) {
      const { updateProfile } = await import("firebase/auth");
      await updateProfile(currentUser, { displayName: name });
    }
  } catch {
    // 기록 실패는 무시 — 앱 흐름을 막지 않는다(best-effort)
  }
}

/**
 * 동의 철회 시 본인의 `app_users/{uid}` 문서(이름)를 삭제한다.
 *
 * - 현재 익명 uid를 얻는다(`getCurrentUid()` 우선, 없으면 currentUser).
 * - uid 없거나 `getDb()` null이면 그냥 종료(best-effort).
 * - `app_users/{본인 uid}`만 삭제한다. 다른 컬렉션·문서는 절대 건드리지 않는다.
 * - 실패는 throw하지 않고 삼킨다(best-effort) — 규칙 미게시·오프라인에서도
 *   로컬 철회는 진행되어야 한다.
 */
export async function deleteUserProfile(): Promise<void> {
  try {
    const uid = getCurrentUid() ?? getAuthInstance()?.currentUser?.uid;
    if (!uid) return; // uid 없음 — best-effort이므로 조용히 종료

    const db = getDb();
    if (!db) return; // Firebase 미설정 — 조용히 종료

    const { doc, deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, "app_users", uid));
  } catch {
    // 삭제 실패는 무시 — 로컬 철회는 계속 진행된다(best-effort)
  }
}
