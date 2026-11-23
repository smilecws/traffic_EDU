"use client";

import { useEffect } from "react";
import { captureGroupCodeFromSearch } from "@/lib/services/groupCodeService";
import { captureSurveyFlagFromSearch } from "@/lib/services/surveyService";

/**
 * 진입 URL의 `?g=`(교육 회차 코드)와 `?s=1`(만족도 조사 여부)을 한 번 읽어
 * localStorage에 저장한다.
 *
 * - 화면을 그리지 않는다(마운트 부수효과 전용).
 * - `useSearchParams` 대신 `window.location.search`를 읽어 Suspense 경계 없이 동작한다.
 * - 코드가 없거나 형식이 틀리면 아무 일도 하지 않는다(일반 사용자 흐름 그대로).
 * - 설문 플래그는 회차 코드가 같은 URL에 있을 때만 저장한다 — 설문은 회차 단위다.
 */
export default function GroupCodeCapture() {
  useEffect(() => {
    const { search } = window.location;
    const code = captureGroupCodeFromSearch(search);
    captureSurveyFlagFromSearch(search, code);
  }, []);

  return null;
}
