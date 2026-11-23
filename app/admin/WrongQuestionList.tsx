"use client";

import { Check } from "lucide-react";
import type { GroupQuestionStat } from "@/lib/services/adminStatsService";
import { Card } from "@/components/shared/Card";
import { cn } from "@/lib/utils/cn";

/**
 * 교육생이 틀린 문항 목록 — 누르면 문제 전문·선택지·정답·해설까지 펼쳐진다.
 *
 * 예전에는 유형(3분류)별 오답률 카드를 먼저 보여줬지만, 교육장에서 쓸모 있는 것은
 * "무엇을 틀렸는지"였다. 그래서 분류 집계를 빼고 이 목록을 본문으로 올렸다.
 * 사진·상황 문제는 이미지 없이는 문제가 성립하지 않으므로 이미지도 함께 띄운다.
 */
export function WrongQuestionList({
  questions,
  wrongQuestionCount,
}: {
  questions: GroupQuestionStat[];
  /**
   * 이 회차에서 한 번이라도 틀린 문항 수(필터 적용 전).
   * 목록이 비었을 때 "틀린 게 없다"와 "필터에 걸렸다"를 구분해 안내한다.
   */
  wrongQuestionCount: number;
}) {
  if (questions.length === 0) {
    return (
      <Card>
        <p className="text-sm leading-relaxed text-slate-600">
          {wrongQuestionCount === 0
            ? "이 회차에서 틀린 문항이 없습니다."
            : "최소 응답 수 조건에 걸려 표시할 문항이 없습니다. 값을 낮춰 보세요."}
        </p>
      </Card>
    );
  }

  return (
    <ol className="space-y-2">
      {questions.map((stat, index) => (
        <li key={stat.questionId}>
          <Card className="p-0">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-400">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  {/* 접혀 있을 때만 두 줄로 줄이고, 펼치면 전문이 드러난다
                      (본문에서 다시 출력하지 않아 중복이 없다). */}
                  <p className="line-clamp-2 text-sm leading-relaxed text-slate-900 group-open:line-clamp-none">
                    {stat.text}
                  </p>
                  <span className="text-xs tabular-nums text-slate-400">
                    {stat.number !== null ? `${stat.number}번 · ` : ""}
                    {stat.bucketLabel} · 오답 {stat.wrong}/{stat.attempts}
                    <span className="ml-1 text-violet-600 group-open:hidden">
                      펼치기
                    </span>
                  </span>
                </div>

                <span className="shrink-0 text-sm font-semibold tabular-nums text-red-500">
                  {Math.round(stat.wrongRate * 100)}%
                </span>
              </summary>

              <div className="space-y-3 border-t border-[#ebe9f5] p-4">
                {stat.question === null ? (
                  <p className="text-sm leading-relaxed text-slate-600">
                    문제 데이터에서 이 문항을 찾지 못했습니다(id{" "}
                    <code>{stat.questionId}</code>). 문제 파일이 갱신되어 번호가
                    바뀐 경우일 수 있습니다.
                  </p>
                ) : (
                  <>
                    {/* 상황 설명(이미지 보조 텍스트) */}
                    {stat.question.imageNotes &&
                      stat.question.imageNotes.length > 0 && (
                        <ul className="space-y-1 rounded-lg border border-[#ebe9f5] bg-[#f5f4fb] p-3 text-sm text-slate-600">
                          {stat.question.imageNotes.map((note, i) => (
                            <li key={i} className="leading-relaxed">
                              · {note}
                            </li>
                          ))}
                        </ul>
                      )}

                    {/* 원본 치수가 제각각이라 확대하지 않고 최대 크기만 제한한다. */}
                    {stat.question.images?.map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={src}
                        src={src}
                        alt="문제 이미지"
                        className="mx-auto block h-auto max-h-72 w-auto max-w-full rounded-lg border border-[#ebe9f5]"
                      />
                    ))}

                    {stat.question.video && (
                      <video
                        src={stat.question.video}
                        controls
                        className="w-full rounded-lg border border-[#ebe9f5]"
                      />
                    )}

                    <ul className="space-y-1.5">
                      {stat.question.choices.map((choice) => {
                        const isAnswer =
                          stat.question?.answerIds.includes(choice.id) ?? false;
                        return (
                          <li
                            key={choice.id}
                            className={cn(
                              "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm leading-relaxed",
                              isAnswer
                                ? "border-violet-300 bg-violet-50 font-medium text-violet-900"
                                : "border-[#ebe9f5] text-slate-600",
                            )}
                          >
                            <span className="shrink-0 tabular-nums">
                              {choice.id}.
                            </span>
                            <span className="min-w-0 flex-1">{choice.text}</span>
                            {isAnswer && (
                              <Check
                                size={16}
                                strokeWidth={2}
                                className="mt-0.5 shrink-0 text-violet-600"
                                aria-label="정답"
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {stat.question.explanation && (
                      <div className="space-y-2 rounded-lg border border-[#ebe9f5] bg-[#f5f4fb] p-3">
                        <p className="text-xs font-medium text-slate-400">
                          해설
                        </p>
                        <p className="text-sm leading-relaxed text-slate-600">
                          {stat.question.explanation}
                        </p>
                        {stat.question.explanationImages?.map((src) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={src}
                            src={src}
                            alt="해설 이미지"
                            className="mx-auto block h-auto max-h-72 w-auto max-w-full rounded-lg border border-[#ebe9f5]"
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </details>
          </Card>
        </li>
      ))}
    </ol>
  );
}
