import type { Question } from "@/lib/types";
import {
  type Classifier,
  UNCLASSIFIED,
} from "@/lib/services/questionClassifier";

/**
 * 관리자 전용 — 오답률 집계.
 *
 * 브라우저는 Firestore를 직접 읽지 않는다. 서버 라우트(`/api/admin/stats`)가
 * 서비스 계정으로 읽어 **문항별 시도/오답 수만** 내려주고, 문제 텍스트 조인과
 * 분류 집계는 이미 문제 데이터를 갖고 있는 클라이언트에서 한다.
 *
 * 범위는 두 가지다 — 교육 회차 하나(`loadGroupStats`)와
 * 전체 기간·전체 회차(`loadAllStats`). 응답 가공·정렬 로직은 공유한다.
 */

/** 집계 범위. */
export type StatsScope = "group" | "all";

/** 서버가 내려주는 원시 집계(문항별 카운트). */
interface StatsResponse {
  code: string;
  from: string;
  to: string;
  sessions: number;
  counts: { questionId: string; attempts: number; wrong: number }[];
}

/** 문항 1건의 회차 내 성적. */
export interface GroupQuestionStat {
  questionId: string;
  /** 표시용 문제 번호 — 문제 데이터에 없으면 null */
  number: number | null;
  text: string;
  bucketLabel: string;
  /**
   * 문제 전문(선택지·정답·해설·이미지). 문제 데이터에 없는 id면 null.
   * 관리자 화면이 틀린 문항을 펼쳐 복기할 수 있게 조인해서 넘긴다.
   */
  question: Question | null;
  attempts: number;
  wrong: number;
  /** 0..1 */
  wrongRate: number;
}

/** 집계 결과 전체. 회차 하나일 수도, 전체 범위일 수도 있다. */
export interface GroupStats {
  /** "all"이면 code·from·to는 빈 문자열이다. */
  scope: StatsScope;
  code: string;
  from: string;
  to: string;
  /** 집계에 포함된 세션(문서) 수 */
  sessions: number;
  attempts: number;
  wrong: number;
  /** 0..1 */
  wrongRate: number;
  /** 오답률 내림차순 정렬된 전체 문항 (minAttempts 필터 적용 전) */
  questions: GroupQuestionStat[];
}

/** 범위와 무관하게 필요한 조인 재료. */
export interface LoadStatsOptions {
  /** 문제 텍스트·유형 조인용 (useQuestions 결과) */
  questions: Question[];
  classifier: Classifier;
}

export interface LoadGroupStatsOptions extends LoadStatsOptions {
  code: string;
  /** `yyyy-MM-dd` */
  from: string;
  /** `yyyy-MM-dd` */
  to: string;
}

/** 화면의 "최소 응답 수" 선택지. 자동 보정도 이 값들 안에서만 움직인다. */
export const MIN_ATTEMPTS_OPTIONS = [1, 2, 3, 5, 10] as const;

/**
 * 조회된 데이터로 실제 볼 수 있는 "최소 응답 수" 상한.
 *
 * 세션이 1회뿐이면 모든 문항의 응답 수가 1건이라, 기본값 2건으로는 오답이
 * 34건 있어도 목록이 통째로 빈다. 그런 일이 없도록 데이터가 감당하는 선까지
 * 임계값을 낮춘다. 틀린 문항이 하나도 없으면 null(보정할 것이 없다).
 */
export function maxUsableMinAttempts(
  questions: Pick<GroupQuestionStat, "attempts" | "wrong">[],
): number | null {
  // 목록은 오답 1건 이상만 보여주므로, 임계값도 그 문항들 기준으로 잡는다.
  const maxAttempts = questions.reduce(
    (max, q) => (q.wrong > 0 ? Math.max(max, q.attempts) : max),
    0,
  );
  if (maxAttempts === 0) return null;
  return [...MIN_ATTEMPTS_OPTIONS].reverse().find((n) => n <= maxAttempts) ?? 1;
}

/** 세션이 끊겼을 때 화면이 다시 로그인을 띄우도록 구분하는 에러. */
export class AdminSessionExpiredError extends Error {
  constructor() {
    super("세션이 만료되었습니다. 다시 로그인해 주세요.");
    this.name = "AdminSessionExpiredError";
  }
}

/** 0 나눗셈 없이 비율을 구하고 소수 4자리로 반올림한다. */
function rate(wrong: number, attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.round((wrong / attempts) * 10000) / 10000;
}

/** 서버 응답에서 에러 메시지를 꺼낸다(없으면 기본 문구). */
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // JSON이 아닌 응답 — 기본 문구로
  }
  return "집계를 불러오지 못했습니다.";
}

/** 집계 라우트를 호출해 원시 응답을 받는다. 세션 만료는 전용 에러로 올린다. */
async function fetchStats(params: URLSearchParams): Promise<StatsResponse> {
  const res = await fetch(`/api/admin/stats?${params.toString()}`, {
    cache: "no-store",
  });

  if (res.status === 401) throw new AdminSessionExpiredError();
  if (!res.ok) throw new Error(await readError(res));

  return (await res.json()) as StatsResponse;
}

/**
 * 회차 코드 + 기간으로 집계를 가져와 문항별·분류별 오답률을 만든다.
 * 기간은 양끝 포함, KST 하루 단위(서버에서 경계를 계산한다).
 */
export async function loadGroupStats({
  code,
  from,
  to,
  questions,
  classifier,
}: LoadGroupStatsOptions): Promise<GroupStats> {
  const body = await fetchStats(new URLSearchParams({ code, from, to }));
  return buildStats(body, "group", { questions, classifier });
}

/**
 * 전체 기간·전체 회차 집계.
 *
 * 회차 코드·날짜 조건 없이 `answer_logs` 전체를 읽으므로, 회차 코드를 입력하지
 * 않은 응답까지 포함된다. 회차 비교가 아니라 "문제은행에서 어떤 문항이
 * 꾸준히 틀리는지"를 보려는 용도다.
 */
export async function loadAllStats({
  questions,
  classifier,
}: LoadStatsOptions): Promise<GroupStats> {
  const body = await fetchStats(new URLSearchParams({ scope: "all" }));
  return buildStats(body, "all", { questions, classifier });
}

/** 원시 카운트에 문제 전문·유형을 조인하고 오답률순으로 정렬한다. */
function buildStats(
  body: StatsResponse,
  scope: StatsScope,
  { questions, classifier }: LoadStatsOptions,
): GroupStats {
  const questionById = new Map<string, Question>();
  for (const q of questions) questionById.set(q.id, q);

  const questionStats: GroupQuestionStat[] = [];
  let totalAttempts = 0;
  let totalWrong = 0;

  for (const row of body.counts ?? []) {
    const { questionId, attempts, wrong } = row;
    if (typeof questionId !== "string" || !Number.isFinite(attempts)) continue;

    totalAttempts += attempts;
    totalWrong += wrong;

    const question = questionById.get(questionId);
    const bucket = question ? classifier.classify(question) : UNCLASSIFIED;

    questionStats.push({
      questionId,
      number: question?.number ?? null,
      // 문제 데이터에 없는 id(데이터 불일치)도 집계에선 버리지 않고 표시만 대체한다.
      text: question?.question ?? `(문제 데이터 없음 · id ${questionId})`,
      bucketLabel: bucket.label,
      question: question ?? null,
      attempts,
      wrong,
      wrongRate: rate(wrong, attempts),
    });
  }

  // 오답률 내림차순 → 응답수 내림차순 → 문제번호 오름차순(결정적 정렬)
  questionStats.sort(
    (a, b) =>
      b.wrongRate - a.wrongRate ||
      b.attempts - a.attempts ||
      (a.number ?? 0) - (b.number ?? 0),
  );

  return {
    scope,
    code: body.code ?? "",
    from: body.from ?? "",
    to: body.to ?? "",
    sessions: body.sessions ?? 0,
    attempts: totalAttempts,
    wrong: totalWrong,
    wrongRate: rate(totalWrong, totalAttempts),
    questions: questionStats,
  };
}

/**
 * 집계 결과를 엑셀에서 바로 열리는 CSV 문자열로 만든다.
 * 한글 깨짐 방지를 위해 BOM을 앞에 붙인다.
 *
 * 화면의 "교육생이 틀린 문항" 목록과 같은 조건(오답 1건 이상)으로 내보낸다.
 */
export function toCsv(stats: GroupStats, minAttempts: number): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ["문제번호", "유형", "응답수", "오답수", "오답률(%)", "문제"].map(esc).join(","),
    ...stats.questions
      .filter((q) => q.wrong > 0 && q.attempts >= minAttempts)
      .map((q) =>
        [
          q.number ?? q.questionId,
          q.bucketLabel,
          q.attempts,
          q.wrong,
          Math.round(q.wrongRate * 100),
          q.text,
        ]
          .map(esc)
          .join(","),
      ),
  ];
  return "﻿" + rows.join("\r\n") + "\r\n";
}
