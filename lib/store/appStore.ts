"use client";

import { create } from "zustand";

/**
 * UI 상태 전용 스토어 (Zustand).
 * - 개인 데이터/서버 데이터는 절대 여기에 두지 않는다 (service + TanStack Query 담당).
 * - 테마는 현재 다크 고정이지만 확장(라이트 모드 등)에 대비해 상태로 보관한다.
 */
interface AppState {
  theme: "dark";
  /** 퀴즈 진행 중 여부 — 헤더/네비게이션 등 UI 표시용 가벼운 플래그 */
  quizInProgress: boolean;
  setQuizInProgress: (inProgress: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: "dark",
  quizInProgress: false,
  setQuizInProgress: (inProgress) => set({ quizInProgress: inProgress }),
}));
