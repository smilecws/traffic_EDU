"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, LogOut } from "lucide-react";
import { normalizeGroupCode } from "@/lib/services/groupCodeService";
import {
  AdminSessionExpiredError,
  loadGroupStats,
  toCsv,
  type GroupStats,
} from "@/lib/services/adminStatsService";
import { DEFAULT_CLASSIFIER } from "@/lib/services/questionClassifier";
import { useQuestions } from "@/lib/hooks/useQuestions";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Spinner } from "@/components/shared/Spinner";
import { AdminLogin } from "./AdminLogin";
import { GroupLinkCard } from "./GroupLinkCard";

/** 진입 단계. */
type Phase = "loading" | "unconfigured" | "locked" | "ready";

/** Date → yyyy-MM-dd (로컬 기준, input[type=date] 용). */
function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 관리자 화면 — 교육 회차별 오답률 조회. 일반 내비게이션에는 노출하지 않는다.
 *
 * 비밀번호 검증과 Firestore 읽기는 모두 서버 라우트에서 한다.
 * 이 화면은 결과를 받아 그리는 역할만 한다.
 */
export default function AdminPage() {
  const [phase, setPhase] = useState<Phase>("loading");

  // 진입 시 기존 세션(httpOnly 쿠키)이 살아 있는지 서버에 확인한다.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setPhase("ready");
        else if (res.status === 503) setPhase("unconfigured");
        else setPhase("locked");
      })
      .catch(() => {
        if (!cancelled) setPhase("locked");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
    } finally {
      setPhase("locked");
    }
  }, []);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">회차별 통계</h1>
        {phase === "ready" && (
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut size={16} strokeWidth={1.5} />
            나가기
          </Button>
        )}
      </header>

      {phase === "loading" && (
        <Card className="flex items-center justify-center py-12">
          <Spinner label="확인 중" />
        </Card>
      )}

      {phase === "unconfigured" && (
        <Card>
          <p className="text-sm text-slate-600 leading-relaxed">
            서버에 관리자 비밀번호가 설정되지 않아 이 화면을 쓸 수 없습니다.
            <br />
            <span className="text-xs text-slate-400">
              Vercel 환경변수 <code>ADMIN_PASSWORD</code>를 설정한 뒤 다시
              배포하세요.
            </span>
          </p>
        </Card>
      )}

      {phase === "locked" && <AdminLogin onSuccess={() => setPhase("ready")} />}

      {phase === "ready" && (
        <AdminConsole onSessionExpired={() => setPhase("locked")} />
      )}
    </main>
  );
}

/** 비밀번호 확인을 마친 뒤의 본 화면. */
function AdminConsole({ onSessionExpired }: { onSessionExpired: () => void }) {
  const today = useMemo(() => toDateInput(new Date()), []);
  const { data: questions } = useQuestions();

  const [code, setCode] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [minAttempts, setMinAttempts] = useState(2);
  const [limit, setLimit] = useState(30);

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalized = normalizeGroupCode(code);

  async function handleLoad() {
    if (!normalized || !questions) return;
    setBusy(true);
    setError(null);
    try {
      const result = await loadGroupStats({
        code: normalized,
        from,
        to,
        questions,
        classifier: DEFAULT_CLASSIFIER,
      });
      setStats(result);
    } catch (err) {
      setStats(null);
      if (err instanceof AdminSessionExpiredError) {
        onSessionExpired();
        return;
      }
      setError(err instanceof Error ? err.message : "조회에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    if (!stats) return;
    const blob = new Blob([toCsv(stats, minAttempts)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `오답률_${stats.code}_${stats.from}_${stats.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleQuestions = useMemo(
    () =>
      (stats?.questions ?? [])
        .filter((q) => q.attempts >= minAttempts)
        .slice(0, limit),
    [stats, minAttempts, limit],
  );

  return (
    <div className="space-y-5">
      {/* 조회 조건 */}
      <Card className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">회차 코드</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="예: 1124a"
            className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </label>

        <div className="flex items-end gap-2">
          <label className="block flex-1 space-y-1">
            <span className="text-xs font-medium text-slate-600">시작일</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
            />
          </label>
          <label className="block flex-1 space-y-1">
            <span className="text-xs font-medium text-slate-600">종료일</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
            />
          </label>
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={!normalized || !questions || busy}
          onClick={handleLoad}
        >
          {busy ? "조회 중…" : "조회"}
        </Button>

        {!normalized && code.length > 0 && (
          <p className="text-xs text-red-500">
            코드는 소문자·숫자·하이픈 1~24자여야 합니다.
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </Card>

      <GroupLinkCard code={code} />

      {stats && (
        <>
          {/* 요약 */}
          <Card className="space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-sm text-slate-600">회차 전체 오답률</span>
              <span className="tabular-nums font-mono text-4xl font-bold text-red-500">
                {Math.round(stats.wrongRate * 100)}%
              </span>
            </div>
            <ProgressBar value={Math.round(stats.wrongRate * 100)} max={100} />
            <p className="text-xs text-slate-400 tabular-nums">
              세션 {stats.sessions}회 · 응답 {stats.attempts}건 중 오답{" "}
              {stats.wrong}건
            </p>
            {stats.sessions === 0 && (
              <p className="text-sm text-slate-600 leading-relaxed">
                이 조건에 해당하는 기록이 없습니다. 회차 코드와 날짜를
                확인하세요.
              </p>
            )}
          </Card>

          {stats.sessions > 0 && (
            <>
              {/* 분류별 오답률 */}
              <section className="space-y-2">
                <h2 className="text-base font-semibold text-slate-900">
                  {DEFAULT_CLASSIFIER.label}별 오답률
                </h2>
                <Card className="space-y-3">
                  {stats.buckets.map((b) => (
                    <div key={b.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{b.label}</span>
                        <span className="tabular-nums font-semibold text-slate-900">
                          {b.attempts > 0
                            ? `${Math.round(b.wrongRate * 100)}%`
                            : "—"}
                        </span>
                      </div>
                      <ProgressBar
                        value={Math.round(b.wrongRate * 100)}
                        max={100}
                      />
                      <p className="text-xs text-slate-400 tabular-nums">
                        응답 {b.attempts}건 · 오답 {b.wrong}건
                      </p>
                    </div>
                  ))}
                </Card>
              </section>

              {/* 문항별 */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">
                    많이 틀린 문항
                  </h2>
                  <Button variant="ghost" size="sm" onClick={handleDownload}>
                    <Download size={16} strokeWidth={1.5} />
                    CSV
                  </Button>
                </div>

                <div className="flex gap-2">
                  <label className="flex-1 space-y-1">
                    <span className="text-xs font-medium text-slate-600">
                      최소 응답 수
                    </span>
                    <select
                      value={minAttempts}
                      onChange={(e) => setMinAttempts(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#ebe9f5] bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      {[1, 2, 3, 5, 10].map((n) => (
                        <option key={n} value={n}>
                          {n}건 이상
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex-1 space-y-1">
                    <span className="text-xs font-medium text-slate-600">
                      표시 개수
                    </span>
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#ebe9f5] bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      {[10, 30, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          상위 {n}개
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {visibleQuestions.length === 0 ? (
                  <Card>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      조건을 만족하는 문항이 없습니다. 최소 응답 수를 낮춰
                      보세요.
                    </p>
                  </Card>
                ) : (
                  <Card className="space-y-1 p-2">
                    <ol className="divide-y divide-[#ebe9f5]">
                      {visibleQuestions.map((q, index) => (
                        <li
                          key={q.questionId}
                          className="flex items-center gap-3 px-3 py-2.5"
                        >
                          <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-400">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-900">
                              {q.text}
                            </p>
                            <span className="text-xs text-slate-400 tabular-nums">
                              {q.number !== null ? `${q.number}번 · ` : ""}
                              {q.bucketLabel} · 오답 {q.wrong}/{q.attempts}
                            </span>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-red-500">
                            {Math.round(q.wrongRate * 100)}%
                          </span>
                        </li>
                      ))}
                    </ol>
                  </Card>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
