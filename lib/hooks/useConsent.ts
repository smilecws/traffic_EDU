"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CONSENT_VERSION,
  clearConsent,
  getConsent,
  saveConsent,
  type ConsentRecord,
} from "@/lib/services/consentService";
import {
  deleteUserProfile,
  registerUser,
} from "@/lib/services/userProfileService";
import { validateName } from "@/lib/utils/validateName";

const CONSENT_QUERY_KEY = ["consent"];

/**
 * 이름 수집 동의 상태 관리 hook.
 * - service 레이어(consentService/userProfileService)만 경유한다.
 * - localStorage 읽기는 TanStack Query queryFn(클라이언트 전용)으로 수행 →
 *   서버/하이드레이션 중에는 실행되지 않아 SSR 안전. `ready`는 첫 읽기 완료 여부.
 */
export function useConsent(): {
  consent: ConsentRecord | null;
  ready: boolean;
  grant: (name: string) => Promise<void>;
  withdraw: () => Promise<void>;
} {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CONSENT_QUERY_KEY,
    queryFn: () => getConsent(),
  });

  const grant = useCallback(
    async (name: string) => {
      const result = validateName(name);
      if (!result.ok) {
        throw new Error(result.error); // 호출 UI가 메시지를 표시
      }

      const record: ConsentRecord = {
        name: result.value,
        grantedAt: Date.now(),
        version: CONSENT_VERSION,
      };
      saveConsent(record);
      queryClient.setQueryData(CONSENT_QUERY_KEY, record);

      // 서버 기록은 best-effort — 실패해도 동의 상태에는 영향 없음.
      void registerUser(result.value);
    },
    [queryClient],
  );

  const withdraw = useCallback(async () => {
    // 서버 이름 삭제(best-effort) → 로컬 동의 삭제 순으로 데이터만 정리한다.
    // 게이트 재표시(홈으로 hard reload)는 호출 UI(step 1) 책임 — 여기선
    // reload/navigation을 하지 않는다.
    await deleteUserProfile();
    clearConsent();
    queryClient.setQueryData(CONSENT_QUERY_KEY, null);
  }, [queryClient]);

  return {
    consent: query.data ?? null,
    ready: query.isFetched,
    grant,
    withdraw,
  };
}
