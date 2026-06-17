import { getAuthInstance } from "@/lib/firebase";

/**
 * 익명 인증으로 안정적 uid를 확보한다 (로그인 UI 없음, silent).
 *
 * - Firebase 미설정이면 null 반환.
 * - 이미 로그인돼 있으면 기존 uid 반환.
 * - 없으면 `signInAnonymously`로 익명 로그인 후 uid 반환.
 * - 익명 로그인만 사용한다 (이메일/비번/소셜 금지).
 * - 실패(미설정/네트워크/콘솔 미활성)는 throw하지 않고 null 반환 (best-effort).
 */
export async function ensureAnonymousSignIn(): Promise<string | null> {
  try {
    const auth = getAuthInstance();
    if (!auth) return null; // Firebase 미설정 — best-effort이므로 조용히 종료

    if (auth.currentUser) return auth.currentUser.uid;

    const { signInAnonymously } = await import("firebase/auth");
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch {
    // 익명 로그인 실패는 무시 — 앱 흐름을 막지 않는다 (best-effort)
    return null;
  }
}

/** 현재 익명 사용자의 uid를 반환한다 (없으면 null). */
export function getCurrentUid(): string | null {
  return getAuthInstance()?.currentUser?.uid ?? null;
}
