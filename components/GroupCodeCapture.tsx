"use client";

import { useEffect } from "react";
import { captureGroupCodeFromSearch } from "@/lib/services/groupCodeService";
import { fetchSessionState } from "@/lib/services/sessionService";
import { setSurveyForCode } from "@/lib/services/surveyService";

/**
 * 진입 URL의 `?g=`(교육 회차 코드)를 한 번 읽어 저장하고, 그 회차가 만족도
 * 조사를 받는지 **서버에 물어** 반영한다.
 *
 * - 화면을 그리지 않는다(마운트 부수효과 전용).
 * - `useSearchParams` 대신 `window.location.search`를 읽어 Suspense 경계 없이 동작한다.
 * - 코드가 없거나 형식이 틀리면 아무 일도 하지 않는다(일반 사용자 흐름 그대로).
 *
 * 코드 저장은 **동기**, 설문 확인은 **비동기**다. 순서를 이렇게 둔 이유는,
 * 네트워크가 느린 교육장에서 확인을 기다리다 사용자가 다른 화면으로 넘어가면
 * 회차 코드를 통째로 놓치기 때문이다. 코드는 먼저 적고, 설문은 답이 오면 켠다.
 *
 * 예전에는 주소의 `&s=1`만 보고 설문을 켰다. 교육생이 직접 붙여도 열려서,
 * 설문을 받지 않기로 한 회차에 응답이 쌓일 수 있었다. 이제 켜고 끄는 것은
 * 서버의 회차 등록부가 정한다.
 */
export default function GroupCodeCapture() {
  useEffect(() => {
    const code = captureGroupCodeFromSearch(window.location.search);
    if (!code) return;

    let cancelled = false;
    void (async () => {
      const { ok, survey } = await fetchSessionState(code);
      if (cancelled) return;
      setSurveyForCode(code, ok && survey);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
