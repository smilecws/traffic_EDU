"use client";

import { useCallback, useEffect, useRef } from "react";

export interface BackGuardOptions {
  /** 가드 설치 여부. false면 아무것도 가로채지 않고 leave 계열이 동작만 즉시 실행한다. */
  enabled?: boolean;
  /**
   * 떠나기 전 확인. false를 반환하면 현재 화면을 유지한다.
   * 앱 ← 버튼과 브라우저 뒤로가기 양쪽에서 똑같이 호출된다.
   */
  confirmLeave?: () => boolean;
  /** 확인을 통과했을 때 실제로 수행할 이탈 동작(주로 router.replace). */
  onLeave: () => void;
}

export interface BackGuard {
  /** 앱 ← 버튼 핸들러. 확인 → 가드 해제 → onLeave 순으로 진행한다. */
  requestLeave: () => void;
  /** 확인 없이 떠나는 경로(예: 채점 완료 → 결과 화면). 가드만 걷어내고 action 실행. */
  leaveWith: (action: () => void) => void;
}

/** history.back() 후 popstate가 오지 않을 때를 대비한 안전망(ms). */
const POPSTATE_FALLBACK_MS = 300;

/**
 * 브라우저 뒤로가기를 앱 ← 버튼과 같은 동작으로 맞춘다.
 *
 * 브라우저의 뒤로가기 버튼 자체는 비활성화할 수 없다. 대신 현재 URL로 히스토리
 * 항목("가드")을 하나 더 심어 두고, 뒤로가기로 그 항목이 사라질 때 발생하는
 * popstate를 가로채 앱의 이탈 로직을 그대로 태운다.
 *
 * 앱 ← 버튼도 반드시 requestLeave를 거쳐야 한다. 그래야 심어 둔 가드 항목이
 * 함께 걷히고, 떠난 뒤 다시 뒤로가기를 눌렀을 때 이 화면으로 되돌아오지 않는다.
 */
export function useBackGuard({
  enabled = true,
  confirmLeave,
  onLeave,
}: BackGuardOptions): BackGuard {
  // 핸들러는 매 렌더 바뀔 수 있으므로 ref로 최신값을 들고 간다
  // (가드 설치 effect를 다시 돌리지 않기 위해).
  const enabledRef = useRef(enabled);
  const confirmRef = useRef(confirmLeave);
  const onLeaveRef = useRef(onLeave);
  // 렌더 중에는 ref를 건드리지 않는다(react-hooks/refs) — 매 렌더 후 갱신.
  useEffect(() => {
    enabledRef.current = enabled;
    confirmRef.current = confirmLeave;
    onLeaveRef.current = onLeave;
  });

  /** 우리가 의도적으로 호출한 history.back()인지 표시 — 확인창을 다시 띄우지 않는다. */
  const pendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const pushGuard = () => {
      // 이미 가드 항목 위에 있으면 또 쌓지 않는다(개발 모드 StrictMode 재마운트 등).
      const state = window.history.state as { backGuard?: boolean } | null;
      if (state?.backGuard) return;
      window.history.pushState({ backGuard: true }, "");
    };
    pushGuard();

    const handlePopState = () => {
      const pending = pendingRef.current;
      if (pending) {
        // 앱 ← 버튼 등 우리가 시작한 이탈 — 확인은 이미 끝났다.
        pendingRef.current = null;
        pending();
        return;
      }
      if (confirmRef.current && !confirmRef.current()) {
        pushGuard(); // 취소 — 가드를 다시 심어 현재 화면을 유지한다.
        return;
      }
      onLeaveRef.current();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enabled]);

  const leaveWith = useCallback((action: () => void) => {
    if (!enabledRef.current) {
      action();
      return;
    }
    pendingRef.current = action;
    window.history.back(); // 가드 항목 제거 → popstate에서 action 실행
    window.setTimeout(() => {
      if (pendingRef.current !== action) return;
      pendingRef.current = null;
      action(); // popstate가 오지 않은 경우(가드가 이미 소비됨 등)
    }, POPSTATE_FALLBACK_MS);
  }, []);

  const requestLeave = useCallback(() => {
    if (confirmRef.current && !confirmRef.current()) return;
    leaveWith(() => onLeaveRef.current());
  }, [leaveWith]);

  return { requestLeave, leaveWith };
}
