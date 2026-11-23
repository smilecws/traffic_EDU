"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, LogOut } from "lucide-react";
import { normalizeGroupCode } from "@/lib/services/groupCodeService";
import {
  AdminSessionExpiredError,
  MIN_ATTEMPTS_OPTIONS,
  loadAllStats,
  loadGroupStats,
  maxUsableMinAttempts,
  toCsv,
  type GroupStats,
} from "@/lib/services/adminStatsService";
import {
  loadAllSurveyStats,
  loadSurveyStats,
  type SurveyStats,
} from "@/lib/services/adminSurveyService";
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
import { SurveyResultCard } from "./SurveyResultCard";
import { WrongQuestionList } from "./WrongQuestionList";

/** 진입 단계. */
type Phase = "loading" | "unconfigured" | "locked" | "ready";

/** 관리자 화면의 두 가지 일 — 교육 전 발급, 교육 후 조회. */
type Tab = "issue" | "stats";

/** 회차 무관 조회의 기간 선택지. */
type AllRange = "all" | "7d" | "30d" | "custom";

const ALL_RANGE_LABELS: Record<AllRange, string> = {
  all: "전체 기간",
  "7d": "최근 7일",
  "30d": "최근 30일",
  custom: "직접 지정",
};

/** Date → yyyy-MM-dd (로컬 기준, input[type=date] 용). */
function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 오늘을 포함해 최근 n일의 시작일. n=7이면 오늘과 그 앞 6일. */
function recentStart(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  return toDateInput(d);
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

  /** 회차 무관 조회의 기간 — 기본은 전체 기간. */
  const [allRange, setAllRange] = useState<AllRange>("all");
  const [allFrom, setAllFrom] = useState(() => recentStart(30));
  const [allTo, setAllTo] = useState(today);

  const [stats, setStats] = useState<GroupStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** 만족도 집계 — 오답률과 같은 조건으로 함께 불러온다. */
  const [survey, setSurvey] = useState<SurveyStats | null>(null);
  const [surveyError, setSurveyError] = useState<string | null>(null);

  /** 달력에서 펼쳐 둔 날 — 회차를 아직 고르지 않았을 때 안내를 띄우는 데 쓴다. */
  const [pickedDay, setPickedDay] = useState<CalendarDay | null>(null);

  const normalized = normalizeGroupCode(code);

  /**
   * 만족도 집계를 받아 담는다. 오답률과 **독립적으로** 처리한다 — 설문 쪽이
   * 실패해도(색인 미생성 등) 오답률 화면까지 같이 죽으면 안 된다.
   */
  const receiveSurvey = useCallback(
    async (pending: Promise<SurveyStats>) => {
      try {
        setSurvey(await pending);
      } catch (err) {
        if (err instanceof AdminSessionExpiredError) {
          onSessionExpired();
          return;
        }
        setSurveyError(
          err instanceof Error
            ? err.message
            : "만족도 응답을 불러오지 못했습니다.",
        );
      }
    },
    [onSessionExpired],
  );

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
      setSurvey(null);
      setSurveyError(null);
      void receiveSurvey(loadSurveyStats(params));
      try {
        const result = await loadGroupStats({
          ...params,
          questions,
          classifier: DEFAULT_CLASSIFIER,
        });
        setStats(result);

        // 임계값 때문에 결과가 통째로 비는 일을 막는다(세션 1회 회차 등).
        const usable = maxUsableMinAttempts(result.questions);
        if (usable !== null) setMinAttempts((prev) => Math.min(prev, usable));
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
    [questions, onSessionExpired, receiveSurvey],
  );

  /**
   * 회차 무관 집계. 회차 조건이 없으므로 달력 선택 상태를 비운다.
   * 기간을 비워 호출하면 전체 기간이다. 코드 없이 들어온 응답까지 포함된다.
   */
  const runLoadAll = useCallback(
    async (range: { from?: string; to?: string }) => {
      if (!questions) return;
      setBusy(true);
      setError(null);
      setStats(null);
      setSurvey(null);
      setSurveyError(null);
      setPickedDay(null);
      void receiveSurvey(loadAllSurveyStats(range));
      try {
        const result = await loadAllStats({
          ...range,
          questions,
          classifier: DEFAULT_CLASSIFIER,
        });
        setStats(result);

        const usable = maxUsableMinAttempts(result.questions);
        if (usable !== null) setMinAttempts((prev) => Math.min(prev, usable));
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
    [questions, onSessionExpired, receiveSurvey],
  );

  /**
   * 기간 선택지를 실제 조회 조건으로 바꾼다. "전체 기간"은 빈 객체 —
   * 서버가 날짜 조건 없이 컬렉션 전체를 읽는다.
   */
  const resolveAllRange = useCallback(
    (range: AllRange): { from?: string; to?: string } => {
      switch (range) {
        case "all":
          return {};
        case "7d":
          return { from: recentStart(7), to: today };
        case "30d":
          return { from: recentStart(30), to: today };
        case "custom":
          return { from: allFrom, to: allTo };
      }
    },
    [today, allFrom, allTo],
  );

  /**
   * 기간 칩을 누르면 바로 조회한다(의도가 분명한 조작이므로 한 번에 끝낸다).
   * "직접 지정"만 날짜 입력을 펼치고 조회 버튼을 기다린다.
   */
  const handleAllRangePick = useCallback(
    (range: AllRange) => {
      setAllRange(range);
      if (range !== "custom") void runLoadAll(resolveAllRange(range));
    },
    [runLoadAll, resolveAllRange],
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
    a.download =
      stats.scope === "all"
        ? stats.from
          ? `오답률_전체회차_${stats.from}_${stats.to}.csv`
          : `오답률_전체기간_${today}.csv`
        : `오답률_${stats.code}_${stats.from}_${stats.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 이 회차에서 한 번이라도 틀린 문항 수 — 빈 목록의 사유를 가르는 데 쓴다. */
  const wrongQuestionCount = useMemo(
    () => (stats?.questions ?? []).filter((q) => q.wrong > 0).length,
    [stats],
  );

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
          {/* 회차 비교가 아니라 문제은행 난이도를 볼 때 쓰는 회차 무관 조회. */}
          <Card className="space-y-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-slate-900">
                회차 무관 기간 조회
              </p>
              <p className="text-xs leading-relaxed text-slate-500">
                고른 기간의 모든 회차를 합쳐 오답률을 봅니다. 회차 코드 없이
                들어온 응답도 포함됩니다.
              </p>
            </div>

            <div
              role="group"
              aria-label="조회 기간"
              className="grid grid-cols-4 gap-1 rounded-xl bg-[#f5f4fb] p-1"
            >
              {(Object.keys(ALL_RANGE_LABELS) as AllRange[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={allRange === value}
                  disabled={!questions || busy}
                  onClick={() => handleAllRangePick(value)}
                  className={cn(
                    "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                    allRange === value
                      ? "bg-white text-violet-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {ALL_RANGE_LABELS[value]}
                </button>
              ))}
            </div>

            {allRange === "custom" && (
              <>
                <div className="flex items-end gap-2">
                  <label className="block flex-1 space-y-1">
                    <span className="text-xs font-medium text-slate-600">
                      시작일
                    </span>
                    <input
                      type="date"
                      value={allFrom}
                      max={allTo}
                      onChange={(e) => setAllFrom(e.target.value)}
                      className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
                    />
                  </label>
                  <label className="block flex-1 space-y-1">
                    <span className="text-xs font-medium text-slate-600">
                      종료일
                    </span>
                    <input
                      type="date"
                      value={allTo}
                      min={allFrom}
                      onChange={(e) => setAllTo(e.target.value)}
                      className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
                    />
                  </label>
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={!questions || busy || allFrom > allTo}
                  onClick={() => void runLoadAll(resolveAllRange("custom"))}
                >
                  {busy ? "조회 중…" : "조회"}
                </Button>

                {allFrom > allTo && (
                  <p className="text-xs text-red-500">
                    시작일이 종료일보다 늦습니다.
                  </p>
                )}
              </>
            )}
          </Card>

          <SessionCalendar
            selectedCode={stats?.scope === "group" ? stats.code : null}
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
                  {stats.scope === "all" ? (
                    stats.from ? (
                      `전체 회차 · ${
                        stats.from === stats.to
                          ? stats.from
                          : `${stats.from} ~ ${stats.to}`
                      }`
                    ) : (
                      "전체 회차 · 전체 기간"
                    )
                  ) : (
                    <>
                      <code className="text-slate-600">{stats.code}</code>
                      {stats.from === stats.to
                        ? ` · ${stats.from}`
                        : ` · ${stats.from} ~ ${stats.to}`}
                    </>
                  )}
                </p>
                <div className="flex items-end justify-between">
                  <span className="text-sm text-slate-600">
                    {stats.scope === "all" ? "전체 오답률" : "회차 전체 오답률"}
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
                    {stats.scope !== "all"
                      ? "이 조건에 해당하는 기록이 없습니다. 회차 코드와 날짜를 확인하세요."
                      : stats.from
                        ? "이 기간에는 응답 기록이 없습니다. 기간을 넓혀 보세요."
                        : "아직 쌓인 응답 기록이 없습니다."}
                  </p>
                )}
              </Card>

              {stats.sessions > 0 && (
                <>
                  {/* 문항별 */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold text-slate-900">
                        {stats.scope === "all"
                          ? "많이 틀린 문항"
                          : "교육생이 틀린 문항"}
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
                          {MIN_ATTEMPTS_OPTIONS.map((n) => (
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

                    <WrongQuestionList
                      questions={visibleQuestions}
                      wrongQuestionCount={wrongQuestionCount}
                      scope={stats.scope}
                    />
                  </section>
                </>
              )}

              {/* 만족도 — 오답률과 같은 조건으로 불러온다. */}
              {survey && <SurveyResultCard survey={survey} today={today} />}

              {surveyError && (
                <Card>
                  <p className="text-sm text-slate-600">
                    만족도 응답을 불러오지 못했습니다.{" "}
                    <span className="text-slate-400">{surveyError}</span>
                  </p>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
