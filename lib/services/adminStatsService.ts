import type { Question } from "@/lib/types";
import {
  type Classifier,
  UNCLASSIFIED,
} from "@/lib/services/questionClassifier";

/**
 * 관리자 전용 — 교육 회차(그룹)별 오답률.
 *
 * 브라우저는 Firestore를 직접 읽지 않는다. 서버 라우트(`/api/admin/stats`)가
 * 서비스 계정으로 읽어 **문항별 시도/오답 수만** 내려주고, 문제 텍스트 조인과
 * 분류 집계는 이미 문제 데이터를 갖고 있는 클라이언트에서 한다.
 */

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

/** 회차 집계 결과 전체. */
export interface GroupStats {
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

export interface LoadGroupStatsOptions {
  code: string;
  /** `yyyy-MM-dd` */
  from: string;
  /** `yyyy-MM-dd` */
  to: string;
  /** 문제 텍스트·유형 조인용 (useQuestions 결과) */
  questions: Question[];
  classifier: Classifier;
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
  const params = new URLSearchParams({ code, from, to });
  const res = await fetch(`/api/admin/stats?${params.toString()}`, {
    cache: "no-store",
  });

  if (res.status === 401) throw new AdminSessionExpiredError();
  if (!res.ok) throw new Error(await readError(res));

  const body = (await res.json()) as StatsResponse;

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
    code: body.code,
    from: body.from,
    to: body.to,
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
