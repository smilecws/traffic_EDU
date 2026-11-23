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
import type { CalendarDay } from "@/lib/services/adminCalendarService";
import { DEFAULT_CLASSIFIER } from "@/lib/services/questionClassifier";
import { useQuestions } from "@/lib/hooks/useQuestions";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Spinner } from "@/components/shared/Spinner";
import { cn } from "@/lib/utils/cn";
import { AdminLogin } from "./AdminLogin";
import { IssueSessionCard } from "./IssueSessionCard";
import { SessionCalendar } from "./SessionCalendar";
import { WrongQuestionList } from "./WrongQuestionList";

/** 진입 단계. */
type Phase = "loading" | "unconfigured" | "locked" | "ready";

/** 관리자 화면의 두 가지 일 — 교육 전 발급, 교육 후 조회. */
type Tab = "issue" | "stats";

/** Date → yyyy-MM-dd (로컬 기준, input[type=date] 용). */
function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 관리자 화면 — 교육 회차 발급과 회차별 오답률 조회. 일반 내비게이션에는 노출하지 않는다.
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

  // 달력의 useEffect 의존성에 들어가므로 안정적인 참조로 넘긴다.
  const handleSessionExpired = useCallback(() => setPhase("locked"), []);

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">교육 회차 관리</h1>
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
          <p className="text-sm leading-relaxed text-slate-600">
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
        <AdminConsole onSessionExpired={handleSessionExpired} />
      )}
    </main>
  );
}

/** 비밀번호 확인을 마친 뒤의 본 화면. */
function AdminConsole({ onSessionExpired }: { onSessionExpired: () => void }) {
  const today = useMemo(() => toDateInput(new Date()), []);
  const { data: questions } = useQuestions();

  const [tab, setTab] = useState<Tab>("issue");

  const [code, setCode] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [minAttempts, setMinAttempts] = useState(2);
  const [limit, setLimit] = useState(30);

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** 달력에서 펼쳐 둔 날 — 회차를 아직 고르지 않았을 때 안내를 띄우는 데 쓴다. */
  const [pickedDay, setPickedDay] = useState<CalendarDay | null>(null);

  const normalized = normalizeGroupCode(code);

  /**
   * 집계를 불러온다. 달력에서 고른 값으로 바로 조회해야 하는데 setState는
   * 비동기이므로, 조회 조건을 인자로 받는다.
   */
  const runLoad = useCallback(
    async (params: { code: string; from: string; to: string }) => {
      if (!questions) return;
      setBusy(true);
      setError(null);
      // 조회가 시작되면 이전 결과를 즉시 버린다 — 낡은 숫자가 남아 있으면
      // 화면이 "안 바뀐 것"처럼 보인다.
      setStats(null);
      try {
        const result = await loadGroupStats({
          ...params,
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
    },
    [questions, onSessionExpired],
  );

  /** 달력에서 회차를 고른 경우 — 코드와 날짜를 그 회차로 맞추고 바로 조회한다. */
  const handleCalendarSelect = useCallback(
    (selectedCode: string, date: string) => {
      setCode(selectedCode);
      setFrom(date);
      setTo(date);
      void runLoad({ code: selectedCode, from: date, to: date });
    },
    [runLoad],
  );

  /**
   * 달력에서 날짜 칸을 누른 경우.
   *
   * 날짜만 눌러도 이전 결과를 지운다. 그러지 않으면 다른 날짜를 눌렀는데 아래에
   * 지난 회차의 숫자가 그대로 남아 "업데이트가 안 된다"로 보인다.
   * 그 날에 회차가 하나뿐이면 목록을 거치지 않고 바로 조회한다.
   */
  const handleDayPick = useCallback(
    (day: CalendarDay | null) => {
      setPickedDay(day);
      if (!day) return; // 접은 것 — 보고 있던 결과는 그대로 둔다

      setStats(null);
      setError(null);

      if (day.groups.length === 1) {
        handleCalendarSelect(day.groups[0].code, day.date);
      }
    },
    [handleCalendarSelect],
  );

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
        // 오답이 0건인 문항은 "틀린 문항"이 아니므로 제외한다.
        .filter((q) => q.wrong > 0 && q.attempts >= minAttempts)
        .slice(0, limit),
    [stats, minAttempts, limit],
  );

  return (
    <div className="space-y-5">
      {/* 발급 / 조회 전환 */}
      <div
        role="tablist"
        aria-label="관리자 작업"
        className="flex gap-1 rounded-xl bg-[#f5f4fb] p-1"
      >
        {(
          [
            ["issue", "회차 발급"],
            ["stats", "통계 조회"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === value
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "issue" && <IssueSessionCard />}

      {tab === "stats" && (
        <>
          <SessionCalendar
            selectedCode={stats?.code ?? null}
            onDayPick={handleDayPick}
            onSelect={handleCalendarSelect}
            onSessionExpired={onSessionExpired}
          />

          {/* 코드를 직접 아는 경우의 보조 경로 — 기본은 달력이다. */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-violet-600 hover:text-violet-700">
              코드로 직접 조회
            </summary>
            <Card className="mt-2 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">
                  회차 코드
                </span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="예: 1124-chuncheon-7k2"
                  className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <div className="flex items-end gap-2">
                <label className="block flex-1 space-y-1">
                  <span className="text-xs font-medium text-slate-600">
                    시작일
                  </span>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
                  />
                </label>
                <label className="block flex-1 space-y-1">
                  <span className="text-xs font-medium text-slate-600">
                    종료일
                  </span>
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
                onClick={() =>
                  normalized && void runLoad({ code: normalized, from, to })
                }
              >
                {busy ? "조회 중…" : "조회"}
              </Button>

              {!normalized && code.length > 0 && (
                <p className="text-xs text-red-500">
                  코드는 소문자·숫자·하이픈 1~24자여야 합니다.
                </p>
              )}
            </Card>
          </details>

          {busy && (
            <Card className="flex items-center justify-center py-8">
              <Spinner label="조회 중" />
            </Card>
          )}

          {error && (
            <Card>
              <p className="text-sm text-red-500">{error}</p>
            </Card>
          )}

          {/* 날짜만 고른 상태 — 결과가 없는 이유를 비워 두지 않고 말해 준다. */}
          {!stats && !busy && !error && pickedDay && (
            <Card>
              <p className="text-sm leading-relaxed text-slate-600">
                {pickedDay.groups.length === 0
                  ? "이 날은 회차 코드 없는 응답만 있어 조회할 회차가 없습니다."
                  : "위 목록에서 회차를 고르세요."}
              </p>
            </Card>
          )}

          {stats && !busy && (
            <>
              {/* 요약 */}
              <Card className="space-y-3">
                <p className="text-xs text-slate-400">
                  <code className="text-slate-600">{stats.code}</code>
                  {stats.from === stats.to
                    ? ` · ${stats.from}`
                    : ` · ${stats.from} ~ ${stats.to}`}
                </p>
                <div className="flex items-end justify-between">
                  <span className="text-sm text-slate-600">
                    회차 전체 오답률
                  </span>
                  <span className="font-mono text-4xl font-bold tabular-nums text-red-500">
                    {Math.round(stats.wrongRate * 100)}%
                  </span>
                </div>
                <ProgressBar
                  value={Math.round(stats.wrongRate * 100)}
                  max={100}
                />
                <p className="text-xs tabular-nums text-slate-400">
                  세션 {stats.sessions}회 · 응답 {stats.attempts}건 중 오답{" "}
                  {stats.wrong}건
                </p>
                {stats.sessions === 0 && (
                  <p className="text-sm leading-relaxed text-slate-600">
                    이 조건에 해당하는 기록이 없습니다. 회차 코드와 날짜를
                    확인하세요.
                  </p>
                )}
              </Card>

              {stats.sessions > 0 && (
                <>
                  {/* 문항별 */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold text-slate-900">
                        교육생이 틀린 문항
                      </h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownload}
                      >
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
                          onChange={(e) =>
                            setMinAttempts(Number(e.target.value))
                          }
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

                    <WrongQuestionList questions={visibleQuestions} />
                  </section>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
