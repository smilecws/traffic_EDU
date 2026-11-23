"use client";

import { useEffect } from "react";

/**
 * 새로고침·탭(창) 닫기·주소창 이동 시 "나가시겠습니까?" 경고를 띄운다.
 *
 * 문구는 브라우저가 정하며 바꿀 수 없고, 사용자가 페이지와 한 번이라도
 * 상호작용한 뒤에만 뜬다(브라우저 정책). SPA 내부 이동에는 발생하지 않으므로
 * 그쪽은 useBackGuard가 맡는다.
 */
export function useUnloadWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 구형 브라우저는 returnValue가 설정돼야 경고를 띄운다.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);
}
