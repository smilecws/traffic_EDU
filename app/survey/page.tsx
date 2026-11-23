"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Send, TriangleAlert } from "lucide-react";
import {
  COMMENT_MAX_LENGTH,
  RATING_SCALE,
  SURVEY_QUESTIONS,
  SurveySubmitError,
  getSurveyStateServerSnapshot,
  getSurveyStateSnapshot,
  normalizeComment,
  submitSurvey,
  subscribeSurveyState,
  type SurveyRatingId,
} from "@/lib/services/surveyService";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { Spinner } from "@/components/shared/Spinner";
import { cn } from "@/lib/utils/cn";

/** 척도 양끝 설명 — 숫자만 있으면 1이 좋은 쪽인지 헷갈린다. */
const SCALE_ENDS = ["전혀 아니다", "매우 그렇다"] as const;

/**
 * 교육 만족도 조사 화면.
 *
 * 설문이 켜진 회차 QR로 들어온 기기에서만 의미가 있다. 회차가 없거나 이미
 * 응답했으면 그 사실을 알려 주고 폼을 띄우지 않는다(주소를 직접 쳐서 들어온 경우).
 *
 * 응답은 익명이다 — 회차 코드·점수·주관식만 저장하고 식별자는 남기지 않는다.
 */
export default function SurveyPage() {
  const router = useRouter();

  const { code, done } = useSyncExternalStore(
    subscribeSurveyState,
    getSurveyStateSnapshot,
    getSurveyStateServerSnapshot,
  );

  /**
   * localStorage는 하이드레이션 후에야 읽힌다. 그 전에 "설문이 없습니다"를
   * 한 프레임 비추지 않도록, 하이드레이션 전까지는 로딩으로 둔다.
   * (effect + setState 대신 외부 저장소 구독 형태로 — 연쇄 렌더가 없다.)
   */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [ratings, setRatings] = useState<Partial<Record<SurveyRatingId, number>>>(
    {},
  );
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 제출 성공 — `done`보다 우선해서 감사 화면을 보여 준다. */
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = SURVEY_QUESTIONS.every(({ id }) => ratings[id] != null);

  async function handleSubmit() {
    if (!code || !allAnswered) return;
    setBusy(true);
    setError(null);
    try {
      await submitSurvey({
        code,
        ratings: {
          overall: ratings.overall as number,
          useful: ratings.useful as number,
          instructor: ratings.instructor as number,
        },
        comment,
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof SurveySubmitError
          ? err.message
          : "응답을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-4 py-6">
      <PageHeader title="교육 만족도 조사" />

      {!mounted && (
        <Card className="flex items-center justify-center py-12">
          <Spinner label="확인 중" />
        </Card>
      )}

      {mounted && submitted && (
        <Card className="space-y-3 text-center">
          <CircleCheck
            size={40}
            strokeWidth={1.5}
            className="mx-auto text-teal-500"
          />
          <p className="text-base font-semibold text-slate-900">
            응답이 제출되었습니다
          </p>
          <p className="text-sm leading-relaxed text-slate-500">
            참여해 주셔서 감사합니다. 의견은 다음 교육을 준비하는 데 쓰입니다.
          </p>
          <Button size="lg" className="w-full" onClick={() => router.push("/")}>
            홈으로
          </Button>
        </Card>
      )}

      {mounted && !submitted && !code && (
        <Card className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600">
            지금은 참여할 수 있는 만족도 조사가 없습니다.
          </p>
          <p className="text-xs leading-relaxed text-slate-400">
            교육장에서 받은 QR이나 링크로 들어오면 조사가 열립니다. 조사는 교육
            당일에만 열려 있습니다.
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => router.push("/")}
          >
            홈으로
          </Button>
        </Card>
      )}

      {mounted && !submitted && code && done && (
        <Card className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600">
            이미 조사에 응답하셨습니다. 참여해 주셔서 감사합니다.
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => router.push("/")}
          >
            홈으로
          </Button>
        </Card>
      )}

      {mounted && !submitted && code && !done && (
        <>
          <p className="text-xs leading-relaxed text-slate-400">
            응답은 익명으로 처리되며, 누가 답했는지는 기록되지 않습니다.
          </p>

          {SURVEY_QUESTIONS.map(({ id, label }) => (
            <Card key={id} className="space-y-3">
              <fieldset>
                <legend className="text-sm font-medium text-slate-900">
                  {label}
                </legend>

                <div className="mt-3 flex gap-2">
                  {RATING_SCALE.map((n) => (
                    <label key={n} className="flex-1">
                      <input
                        type="radio"
                        name={id}
                        value={n}
                        checked={ratings[id] === n}
                        onChange={() => {
                          setRatings((prev) => ({ ...prev, [id]: n }));
                          setError(null);
                        }}
                        className="peer sr-only"
                      />
                      <span
                        className={cn(
                          "block cursor-pointer rounded-xl border border-[#ebe9f5] py-3 text-center",
                          "font-mono text-base tabular-nums text-slate-500 transition-colors",
                          "hover:bg-[#f5f4fb]",
                          "peer-checked:border-violet-500 peer-checked:bg-violet-50 peer-checked:font-semibold peer-checked:text-violet-700",
                          "peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500",
                        )}
                      >
                        {n}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="mt-1.5 flex justify-between text-xs text-slate-400">
                  <span>{SCALE_ENDS[0]}</span>
                  <span>{SCALE_ENDS[1]}</span>
                </div>
              </fieldset>
            </Card>
          ))}

          <Card className="space-y-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-900">
                개선할 점이 있다면 적어 주세요{" "}
                <span className="font-normal text-slate-400">(선택)</span>
              </span>
              <textarea
                value={comment}
                maxLength={COMMENT_MAX_LENGTH}
                rows={4}
                onChange={(e) => setComment(e.target.value)}
                placeholder="예: 실습 시간이 조금 더 길면 좋겠습니다"
                className="w-full resize-none rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </label>

            {/* 자유 서술로 개인정보가 들어오는 것을 막는 유일한 수단 — 항상 보인다. */}
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-600">
              <TriangleAlert
                size={14}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0"
              />
              <span>
                이름·연락처 등 개인정보는 적지 마세요. 적힌 내용은 그대로
                저장됩니다.
              </span>
            </p>

            <p className="text-right text-xs tabular-nums text-slate-400">
              {normalizeComment(comment).length}/{COMMENT_MAX_LENGTH}
            </p>
          </Card>

          <Button
            size="lg"
            className="w-full"
            disabled={!allAnswered || busy}
            onClick={() => void handleSubmit()}
          >
            <Send size={18} strokeWidth={1.5} />
            {busy ? "제출 중…" : "제출하기"}
          </Button>

          {!allAnswered && (
            <p className="text-center text-xs text-slate-400">
              세 문항 모두 답하면 제출할 수 있습니다.
            </p>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </>
      )}
    </main>
  );
}
