// Firebase 초기화 — Firestore + 익명 인증.
// 환경변수가 없어도 import 시점에 throw하지 않도록 lazy하게 초기화한다.
import { getApps, getApp, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Firebase가 설정되어 있는지(필수 키 존재) 여부. */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

/** 단일 FirebaseApp 인스턴스를 lazy하게 확보한다 (반복 initializeApp 금지). */
function getAppInstance(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Firestore 인스턴스를 lazy하게 반환한다.
 * 환경변수가 없으면 null을 반환한다 (서비스 레이어에서 best-effort 처리).
 */
export function getDb(): Firestore | null {
  if (!isFirebaseConfigured()) return null;
  if (!db) {
    db = getFirestore(getAppInstance());
  }
  return db;
}

/**
 * Auth 인스턴스를 lazy하게 반환한다 (익명 인증 용도).
 * 환경변수가 없으면 null을 반환한다 (서비스 레이어에서 best-effort 처리).
 */
export function getAuthInstance(): Auth | null {
  if (!isFirebaseConfigured()) return null;
  if (!auth) {
    auth = getAuth(getAppInstance());
  }
  return auth;
}
