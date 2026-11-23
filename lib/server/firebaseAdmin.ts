import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK (서버 전용) — 관리자 통계 조회에서만 쓴다.
 *
 * 보안 규칙은 `answer_logs` 읽기를 전면 차단하고 있고, 이 SDK만 서비스 계정으로
 * 규칙을 우회해 읽는다. 즉 브라우저는 로그를 직접 읽을 수 없다.
 *
 * 인증은 환경변수 `FIREBASE_SERVICE_ACCOUNT`(서비스 계정 JSON 문자열)로만 한다.
 * (`NEXT_PUBLIC_` 접두사를 절대 붙이지 않는다 — 클라이언트에 노출된다.)
 */

/** 서비스 계정이 설정되어 있는지. */
export function isServiceAccountConfigured(): boolean {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return Boolean(raw && raw.length > 0);
}

/**
 * Firestore(Admin) 인스턴스를 lazy하게 반환한다.
 * 환경변수 미설정/JSON 오류면 null (호출부가 503으로 안내한다).
 */
export function getAdminDb(): Firestore | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  if (getApps().length === 0) {
    let parsed: ServiceAccount;
    try {
      parsed = JSON.parse(raw) as ServiceAccount;
    } catch {
      return null;
    }
    initializeApp({ credential: cert(parsed) });
  }

  return getFirestore();
}
