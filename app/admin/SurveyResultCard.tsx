"use client";

import { Download } from "lucide-react";
import {
  toSurveyCsv,
  type SurveyStats,
} from "@/lib/services/adminSurveyService";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { ProgressBar } from "@/components/shared/ProgressBar";

/** 척도 양끝 설명 — 설문 화면과 같은 문구. */
const SCALE_HINT = "1 전혀 아니다 ~ 5 매우 그렇다";

/**
 * 만족도 집계 카드 — 오답률 조회와 같은 조건(회차·기간)으로 함께 불러온다.
 *
 * 응답이 0건이어도 카드를 숨기지 않는다. "설문을 안 켠 회차"와 "조회가 아직
 * 안 된 상태"를 구분할 수 없으면, 강사는 응답이 사라진 줄 알고 다시 조회한다.
 */
export function SurveyResultCard({
  survey,
  today,
}: {
  survey: SurveyStats;
  /** CSV 파일명에 쓰는 오늘 날짜(`yyyy-MM-dd`) — 전체 기간 조회용. */
  today: string;
}) {
  function handleDownload() {
    const blob = new Blob([toSurveyCsv(survey)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      survey.scope === "all"
        ? survey.from
          ? `만족도_전체회차_${survey.from}_${survey.to}.csv`
          : `만족도_전체기간_${today}.csv`
        : `만족도_${survey.code}_${survey.from}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (survey.responses === 0) {
    return (
      <Card className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">만족도 조사</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          이 조건에서는 만족도 응답이 없습니다.
        </p>
        <p className="text-xs leading-relaxed text-slate-400">
          교육반 발급 때 &ldquo;만족도 조사 함께 받기&rdquo;를 체크한 QR로 들어온
          교육생만 응답할 수 있습니다.
        </p>
      </Card>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">만족도 조사</h2>
        <Button variant="ghost" size="sm" onClick={handleDownload}>
          <Download size={16} strokeWidth={1.5} />
          CSV
        </Button>
      </div>

      {/* 요약 */}
      <Card className="space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-sm text-slate-600">전체 평균</span>
          <span className="font-mono text-4xl font-bold tabular-nums text-violet-600">
            {survey.overallAverage?.toFixed(2) ?? "–"}
            <span className="text-base font-medium text-slate-400"> / 5</span>
          </span>
        </div>
        <p className="text-xs tabular-nums text-slate-400">
          응답 {survey.responses}건 · {SCALE_HINT}
        </p>
      </Card>

      {/* 문항별 */}
      {survey.items.map((item) => (
        <Card key={item.id} className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-sm text-slate-700">
              {item.label}
            </p>
            <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-slate-900">
              {item.average?.toFixed(2) ?? "–"}
            </span>
          </div>

          {/* 평균을 5점 만점 비율로 — 숫자만으로는 한눈에 안 들어온다. */}
          <ProgressBar value={item.average ?? 0} max={5} />

          <ul className="flex gap-1 text-center text-xs tabular-nums">
            {item.distribution.map((count, i) => (
              <li
                key={i}
                className="flex-1 rounded-lg bg-[#f5f4fb] py-1 text-slate-500"
              >
                <span className="block text-[10px] text-slate-400">
                  {i + 1}점
                </span>
                {count}
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {/* 주관식 */}
      <Card className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-900">주관식 의견</h3>
          <span className="text-xs tabular-nums text-slate-400">
            {survey.comments.length}건
          </span>
        </div>

        {survey.comments.length === 0 ? (
          <p className="text-sm text-slate-600">적어 준 의견이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {survey.comments.map((comment, i) => (
              <li
                key={i}
                className="rounded-xl bg-[#f5f4fb] px-3 py-2 text-sm leading-relaxed text-slate-700"
              >
                {comment}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
