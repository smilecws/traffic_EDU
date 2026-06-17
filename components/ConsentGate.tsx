"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { Spinner } from "@/components/shared/Spinner";
import { useConsent } from "@/lib/hooks/useConsent";
import { validateName } from "@/lib/utils/validateName";

/**
 * 첫 실행 동의 게이트(하드 게이트).
 * - 동의 전에는 children(앱)을 렌더하지 않는다.
 * - localStorage/Firestore 직접 접근 금지 — useConsent 훅만 경유한다.
 * - `!ready`(하이드레이션 전)에는 게이트/children 어느 쪽도 렌더하지 않는다.
 */
export function ConsentGate({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const { consent, ready, grant } = useConsent();

  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 하이드레이션 불일치 방지: 첫 읽기 전에는 가벼운 로딩만.
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // 동의 완료 → 앱 정상 노출.
  if (consent) {
    return <>{children}</>;
  }

  // 동의 전 → 게이트만 노출(앱 차단).
  const validation = validateName(name);
  const nameError = name.length > 0 && !validation.ok ? validation.error : null;
  const canSubmit = validation.ok && agreed && !submitting;

  const handleSubmit = async () => {
    if (!validation.ok || !agreed) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await grant(name);
      // 성공 시 consent가 채워져 이 컴포넌트가 children을 렌더한다.
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "동의 처리 중 문제가 발생했습니다",
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium text-violet-500">초심찾기</p>
        <h1 className="text-2xl font-bold text-slate-900">시작하기 전에</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          서비스 이용자 수 파악을 위해 이름을 수집합니다. 계속하려면 아래 내용에
          동의해 주세요.
        </p>
      </div>

      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">수집 안내</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            <span className="font-medium text-slate-700">수집 항목</span> —
            이름(닉네임 가능)
          </li>
          <li>
            <span className="font-medium text-slate-700">이용 목적</span> —
            서비스 이용자 수 파악
          </li>
          <li>
            <span className="font-medium text-slate-700">거부 권리</span> —
            동의를 거부할 수 있으나, 거부 시 서비스 이용이 제한됩니다.
          </li>
        </ul>
        <Link
          href="/privacy"
          className="inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          개인정보처리방침 보기
        </Link>
      </section>

      <section className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="consent-name"
            className="block text-sm font-medium text-slate-700"
          >
            이름
          </label>
          <input
            id="consent-name"
            type="text"
            value={name}
            maxLength={30}
            autoComplete="off"
            placeholder="이름 또는 닉네임"
            onChange={(e) => {
              setName(e.target.value);
              setSubmitError(null);
            }}
            className="w-full rounded-xl border border-[#ebe9f5] bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          />
          {nameError && <p className="text-xs text-red-500">{nameError}</p>}
        </div>

        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#ebe9f5] text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          />
          <span>개인정보 수집·이용에 동의합니다.</span>
        </label>

        {submitError && <p className="text-xs text-red-500">{submitError}</p>}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          동의하고 시작
        </Button>

        {!canSubmit && !submitting && (
          <p className="text-center text-xs text-slate-400">
            이름을 입력하고 동의에 체크하면 시작할 수 있습니다.
          </p>
        )}
      </section>
    </main>
  );
}
