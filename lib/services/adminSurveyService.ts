import { AdminSessionExpiredError } from "@/lib/services/adminStatsService";
import { SURVEY_QUESTIONS } from "@/lib/services/surveyService";
import type { StatsScope } from "@/lib/services/adminStatsService";

/**
 * 관리자 전용 — 교육 만족도 집계.
 *
 * 오답률 집계와 같은 구조다. 서버 라우트(`/api/admin/survey`)가 서비스 계정으로
 * 읽어 분포만 내려주고, 평균과 문항 라벨 조인은 여기서 한다(문항 정의는
 * 클라이언트가 이미 갖고 있다).
 */

/** 서버가 내려주는 원시 응답. */
interface SurveyResponse {
  code: string;
  from: string;
  to: string;
  responses: number;
  /** 문항 id → 1~5 분포(인덱스 0이 1점) */
  distributions: Record<string, number[]>;
  comments: string[];
}

/** 문항 1건의 집계. */
export interface SurveyItemStat {
  id: string;
  label: string;
  /** 1~5 평균. 응답이 없으면 null */
  average: number | null;
  /** 이 문항에 답한 수(분포 합) */
  answered: number;
  /** 1~5 분포(인덱스 0이 1점) */
  distribution: number[];
}

/** 만족도 집계 결과. */
export interface SurveyStats {
  scope: StatsScope;
  code: string;
  from: string;
  to: string;
  /** 집계에 포함된 응답(문서) 수 */
  responses: number;
  items: SurveyItemStat[];
  /** 주관식 의견 — 응답자가 적은 그대로다. */
  comments: string[];
  /** 전체 문항 평균(문항 평균의 평균). 응답이 없으면 null */
  overallAverage: number | null;
}

export interface LoadSurveyOptions {
  code: string;
  /** `yyyy-MM-dd` */
  from: string;
  /** `yyyy-MM-dd` */
  to: string;
}

export interface LoadAllSurveyOptions {
  /** 둘 다 주면 그 기간, 둘 다 비우면 전체 기간. */
  from?: string;
  to?: string;
}

/** 서버 응답에서 에러 메시지를 꺼낸다(없으면 기본 문구). */
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // JSON이 아닌 응답 — 기본 문구로
  }
  return "만족도 응답을 불러오지 못했습니다.";
}

/** 만족도 라우트를 호출한다. 세션 만료는 전용 에러로 올린다. */
async function fetchSurvey(params: URLSearchParams): Promise<SurveyResponse> {
  const res = await fetch(`/api/admin/survey?${params.toString()}`, {
    cache: "no-store",
  });

  if (res.status === 401) throw new AdminSessionExpiredError();
  if (!res.ok) throw new Error(await readError(res));

  return (await res.json()) as SurveyResponse;
}

/** 회차 코드 + 기간으로 만족도 집계를 가져온다. */
export async function loadSurveyStats({
  code,
  from,
  to,
}: LoadSurveyOptions): Promise<SurveyStats> {
  const body = await fetchSurvey(new URLSearchParams({ code, from, to }));
  return buildSurveyStats(body, "group");
}

/** 회차 무관 만족도 집계 — 기간을 주면 그 기간, 비우면 전체 기간. */
export async function loadAllSurveyStats({
  from,
  to,
}: LoadAllSurveyOptions): Promise<SurveyStats> {
  const params = new URLSearchParams({ scope: "all" });
  if (from && to) {
    params.set("from", from);
    params.set("to", to);
  }
  const body = await fetchSurvey(params);
  return buildSurveyStats(body, "all");
}

/** 분포 → 평균(소수 2자리). 응답이 없으면 null. */
function averageOf(distribution: number[]): number | null {
  const answered = distribution.reduce((sum, n) => sum + n, 0);
  if (answered === 0) return null;
  const total = distribution.reduce((sum, n, i) => sum + n * (i + 1), 0);
  return Math.round((total / answered) * 100) / 100;
}

/** 원시 분포에 문항 라벨을 붙이고 평균을 계산한다. */
function buildSurveyStats(
  body: SurveyResponse,
  scope: StatsScope,
): SurveyStats {
  const items: SurveyItemStat[] = SURVEY_QUESTIONS.map(({ id, label }) => {
    const raw = body.distributions?.[id];
    const distribution =
      Array.isArray(raw) && raw.length === 5
        ? raw.map((n) => (Number.isFinite(n) ? n : 0))
        : [0, 0, 0, 0, 0];
    return {
      id,
      label,
      average: averageOf(distribution),
      answered: distribution.reduce((sum, n) => sum + n, 0),
      distribution,
    };
  });

  const averages = items
    .map((item) => item.average)
    .filter((avg): avg is number => avg !== null);

  return {
    scope,
    code: body.code ?? "",
    from: body.from ?? "",
    to: body.to ?? "",
    responses: body.responses ?? 0,
    items,
    comments: Array.isArray(body.comments)
      ? body.comments.filter((c): c is string => typeof c === "string")
      : [],
    overallAverage:
      averages.length > 0
        ? Math.round(
            (averages.reduce((sum, n) => sum + n, 0) / averages.length) * 100,
          ) / 100
        : null,
  };
}

/**
 * 만족도 결과를 엑셀에서 바로 열리는 CSV로 만든다(BOM 포함).
 *
 * 문항별 분포·평균을 먼저 적고, 그 아래에 주관식을 한 줄씩 붙인다.
 * 주관식을 손으로 옮겨 적지 않고 보고서에 바로 붙일 수 있게 하는 것이 목적이다.
 */
export function toSurveyCsv(survey: SurveyStats): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ["문항", "평균", "응답수", "1점", "2점", "3점", "4점", "5점"]
      .map(esc)
      .join(","),
    ...survey.items.map((item) =>
      [
        item.label,
        item.average ?? "",
        item.answered,
        ...item.distribution,
      ]
        .map(esc)
        .join(","),
    ),
    "",
    [esc("주관식 의견")].join(","),
    ...survey.comments.map((c) => esc(c)),
  ];
  return "﻿" + rows.join("\r\n") + "\r\n";
}
