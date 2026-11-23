import { AdminSessionExpiredError } from "@/lib/services/adminStatsService";

/**
 * 관리자 전용 — "회차가 있었던 날" 달력.
 *
 * 발급 기록 테이블 없이 **쌓인 로그에서 역산**한 결과를 받아온다. 덕분에
 * 관리자는 코드를 외우지 않고 달력 → 날짜 → 회차 순으로 눌러 조회할 수 있다.
 */

/** 그 날짜에 들어온 회차 1건. */
export interface CalendarGroup {
  code: string;
  /** 세션(문서) 수 */
  sessions: number;
}

/** 기록이 있는 날 1건. */
export interface CalendarDay {
  /** `yyyy-MM-dd` (KST) */
  date: string;
  /** 그날 전체 세션 수 */
  sessions: number;
  /** 회차 코드 없이 들어온 세션 수 */
  untagged: number;
  /** 세션 수 내림차순 */
  groups: CalendarGroup[];
}

/** 한 달치 달력. */
export interface CalendarMonth {
  /** `yyyy-MM` */
  month: string;
  /** 기록이 있는 날만, 날짜 오름차순 */
  days: CalendarDay[];
  /** 문서 상한에 걸려 일부가 빠졌는지 */
  truncated: boolean;
}

/** 서버 응답에서 에러 메시지를 꺼낸다(없으면 기본 문구). */
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // JSON이 아닌 응답 — 기본 문구로
  }
  return "달력을 불러오지 못했습니다.";
}

/** 해당 월(`yyyy-MM`)의 달력을 가져온다. */
export async function loadCalendarMonth(
  month: string,
): Promise<CalendarMonth> {
  const res = await fetch(
    `/api/admin/calendar?month=${encodeURIComponent(month)}`,
    { cache: "no-store" },
  );

  if (res.status === 401) throw new AdminSessionExpiredError();
  if (!res.ok) throw new Error(await readError(res));

  const body = (await res.json()) as CalendarMonth;
  return {
    month: body.month,
    days: Array.isArray(body.days) ? body.days : [],
    truncated: body.truncated === true,
  };
}
