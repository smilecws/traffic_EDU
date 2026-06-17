"use client";

import { useEffect, useRef, useState } from "react";

export interface UseCountdownOptions {
  /** false면 타이머가 동작하지 않는다 (비-모의고사 모드 등). */
  active: boolean;
  /** 남은 시간이 0이 되면 1회 호출. */
  onExpire?: () => void;
}

/**
 * 카운트다운 타이머 hook (모의고사 제한 시간용).
 * - setInterval로 1초마다 남은 시간을 갱신하고 cleanup에서 해제한다.
 * - active가 false면 인터벌을 만들지 않는다.
 * - onExpire는 만료 시 1회만 호출한다(중복 제출 방지).
 */
export function useCountdown(
  durationMs: number,
  { active, onExpire }: UseCountdownOptions,
): { remainingMs: number } {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  // onExpire 변경이 인터벌을 재시작하지 않도록 ref로 최신값을 참조한다.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!active) return;

    const endAt = Date.now() + durationMs;
    let expired = false;

    const tick = () => {
      const remaining = Math.max(0, endAt - Date.now());
      setRemainingMs(remaining);
      if (remaining <= 0 && !expired) {
        expired = true;
        onExpireRef.current?.();
      }
    };

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [active, durationMs]);

  return { remainingMs };
}
