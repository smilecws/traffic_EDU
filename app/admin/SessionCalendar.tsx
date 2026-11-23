"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminSessionExpiredError } from "@/lib/services/adminStatsService";
import {
  loadCalendarMonth,
  type CalendarDay,
} from "@/lib/services/adminCalendarService";
import {
  daysInMonth,
  firstWeekdayOfMonth,
  shiftMonth,
  toKstDateString,
  toKstMonthString,
} from "@/lib/utils/kstDate";
import { Card } from "@/components/shared/Card";
import { Spinner } from "@/components/shared/Spinner";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** `yyyy-MM` → "2026년 11월" */
function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

/** `yyyy-MM-dd` → "11월 24일" */
function formatDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

export interface SessionCalendarProps {
  /** 현재 조회 중인 회차 코드(강조 표시용). */
  selectedCode: string | null;
  /**
   * 날짜 칸을 눌렀을 때 — 펼친 날의 정보, 접었으면 null.
   *
   * 날짜만 눌러도 상위가 이전 조회 결과를 지울 수 있어야 한다. 그러지 않으면
   * 다른 날짜를 눌렀는데 아래에 낡은 숫자가 그대로 남아 "안 바뀐다"로 보인다.
   */
  onDayPick: (day: CalendarDay | null) => void;
  /** 회차를 고르면 호출된다 — 코드와 그 날짜(`yyyy-MM-dd`). */
  onSelect: (code: string, date: string) => void;
  /** 세션 만료 시 로그인 화면으로 돌리기 위한 콜백. */
  onSessionExpired: () => void;
}

/**
 * 기록이 있는 날을 금색으로 칠한 달력. 날짜를 누르면 그날 들어온 회차 목록이
 * 펼쳐지고, 회차를 누르면 조회가 시작된다.
 *
 * 회차 코드를 외우거나 날짜를 타이핑할 필요를 없애는 것이 이 화면의 목적이다.
 * 달력 데이터는 발급 기록 테이블이 아니라 쌓인 로그에서 역산한 것이다.
 */
export function SessionCalendar({
  selectedCode,
  onDayPick,
  onSelect,
  onSessionExpired,
}: SessionCalendarProps) {
  const today = useMemo(() => toKstDateString(new Date().getTime()), []);
  const currentMonth = useMemo(
    () => toKstMonthString(new Date().getTime()),
    [],
  );

  const [month, setMonth] = useState(currentMonth);

  /**
   * 펼쳐 둔 날짜. `undefined`는 "아직 손대지 않음"으로, 그 달에 기록이 하루뿐이면
   * 자동으로 펼쳐 준다(탭 한 번 절약). `null`은 사용자가 직접 접은 상태다.
   */
  const [openDate, setOpenDate] = useState<string | null | undefined>(
    undefined,
  );

  const { data, isPending, error } = useQuery({
    queryKey: ["adminCalendar", month],
    queryFn: () => loadCalendarMonth(month),
    // 교육 중에는 응답이 계속 쌓이므로 캐시를 오래 들고 있지 않는다.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  // 세션이 끊기면 조용히 실패하지 않고 로그인 화면으로 돌린다.
  useEffect(() => {
    if (error instanceof AdminSessionExpiredError) onSessionExpired();
  }, [error, onSessionExpired]);

  const days = useMemo<CalendarDay[]>(() => data?.days ?? [], [data]);

  const dayByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const effectiveOpen =
    openDate === undefined
      ? days.length === 1
        ? days[0].date
        : null
      : openDate;

  function handleMonthShift(offset: number) {
    setOpenDate(undefined);
    setMonth((prev) => shiftMonth(prev, offset));
  }

  // 1일 앞의 빈 칸 + 그 달의 날짜 칸
  const cells = useMemo(() => {
    const lead = firstWeekdayOfMonth(month);
    const total = daysInMonth(month);
    const list: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= total; d += 1) {
      list.push(`${month}-${String(d).padStart(2, "0")}`);
    }
    return list;
  }, [month]);

  const openDay = effectiveOpen ? dayByDate.get(effectiveOpen) : undefined;
  const message =
    error && !(error instanceof AdminSessionExpiredError)
      ? error.message || "달력을 불러오지 못했습니다."
      : null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => handleMonthShift(-1)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f5f4fb] hover:text-slate-700"
        >
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>
        <h2 className="text-sm font-semibold tabular-nums text-slate-900">
          {formatMonth(month)}
        </h2>
        <button
          type="button"
          aria-label="다음 달"
          disabled={month >= currentMonth}
          onClick={() => handleMonthShift(1)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f5f4fb] hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 text-xs font-medium text-slate-400">
            {w}
          </span>
        ))}

        {cells.map((date, index) => {
          if (!date) return <span key={`lead-${index}`} />;

          const day = dayByDate.get(date);
          const isOpen = effectiveOpen === date;
          const isToday = date === today;
          const dayOfMonth = Number(date.slice(-2));

          return (
            <button
              key={date}
              type="button"
              disabled={!day}
              aria-pressed={isOpen}
              aria-label={
                day
                  ? `${dayOfMonth}일 세션 ${day.sessions}건`
                  : `${dayOfMonth}일`
              }
              onClick={() => {
                const next = isOpen ? null : date;
                setOpenDate(next);
                // disabled={!day}이므로 펼치는 쪽에서는 day가 항상 있다.
                onDayPick(next && day ? day : null);
              }}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                day
                  ? "font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200"
                  : "text-slate-300",
                day && !isOpen && "bg-amber-100",
                isOpen && "bg-amber-500 text-white ring-amber-500",
                isToday && !isOpen && "ring-1 ring-violet-400",
              )}
            >
              {dayOfMonth}
            </button>
          );
        })}
      </div>

      {isPending && (
        <div className="flex justify-center py-2">
          <Spinner label="달력 불러오는 중" />
        </div>
      )}

      {message && <p className="text-sm text-red-500">{message}</p>}

      {!isPending && !message && days.length === 0 && (
        <p className="text-xs leading-relaxed text-slate-400">
          이 달에는 기록이 없습니다. 기록이 있는 날은 금색으로 표시됩니다.
        </p>
      )}

      {data?.truncated && (
        <p className="text-xs leading-relaxed text-amber-700">
          기록이 너무 많아 이 달의 일부만 표시했습니다.
        </p>
      )}

      {openDay && (
        <div className="space-y-2 border-t border-[#ebe9f5] pt-3">
          <p className="text-xs font-medium tabular-nums text-slate-600">
            {formatDate(openDay.date)} · 세션 {openDay.sessions}건
          </p>

          {openDay.groups.length === 0 ? (
            <p className="text-xs leading-relaxed text-slate-400">
              이 날은 회차 코드 없는 응답만 있습니다(교육장 밖 개인 학습).
            </p>
          ) : (
            <ul className="space-y-1">
              {openDay.groups.map((g) => (
                <li key={g.code}>
                  <button
                    type="button"
                    onClick={() => onSelect(g.code, openDay.date)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                      g.code === selectedCode
                        ? "border-violet-400 bg-violet-50"
                        : "border-[#ebe9f5] hover:bg-[#f5f4fb]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <code className="block truncate text-sm text-slate-900">
                        {g.code}
                      </code>
                      {/* 교육반 이름은 회차 등록부에만 있다 — 옛 회차는 비어 있다. */}
                      {g.branch && (
                        <span className="block truncate text-xs text-slate-400">
                          {g.branch}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-400">
                      세션 {g.sessions}건
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {openDay.untagged > 0 && openDay.groups.length > 0 && (
            <p className="text-xs tabular-nums text-slate-400">
              회차 없는 응답 {openDay.untagged}건은 제외됩니다.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
