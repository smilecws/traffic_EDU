import { Star } from "lucide-react";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/shared/Badge";
import { Card } from "@/components/shared/Card";
import { AnswerButton } from "./AnswerButton";

export interface QuizCardProps {
  question: Question;
  /** 현재 문제에서 사용자가 고른 선택지 id 목록 */
  selectedIds: number[];
  /** 제출(채점)했는지 */
  submitted: boolean;
  onToggle: (id: number) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

/** 문제 텍스트 + 미디어 + 선택지 + (제출 후) 해설을 보여주는 카드. */
export function QuizCard({
  question,
  selectedIds,
  submitted,
  onToggle,
  isFavorite,
  onToggleFavorite,
}: QuizCardProps) {
  const multiAnswer = question.answerIds.length > 1;

  return (
    <Card className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{question.number}번</Badge>
          {multiAnswer && (
            <Badge variant="warning">정답 {question.answerIds.length}개</Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
          className="rounded-md p-1 text-slate-400 transition-colors hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Star
            strokeWidth={1.5}
            className={cn("h-5 w-5", isFavorite && "fill-amber-500 text-amber-500")}
          />
        </button>
      </div>

      <p className="text-base font-medium text-slate-900 leading-relaxed">
        {question.question}
      </p>

      {/* 상황 설명 (이미지 보조 텍스트) */}
      {question.imageNotes && question.imageNotes.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-[#ebe9f5] bg-[#f5f4fb] p-4 text-sm text-slate-600">
          {question.imageNotes.map((note, i) => (
            <li key={i} className="leading-relaxed">
              · {note}
            </li>
          ))}
        </ul>
      )}

      {/* 문제 이미지 — 원본보다 확대하지 않고 최대 크기만 제한, 가운데 정렬.
          (원본 치수가 71px~4624px로 제각각이라 w-full 강제 확대는 금지) */}
      {question.images?.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt="문제 이미지"
          className="mx-auto block h-auto max-h-96 w-auto max-w-full rounded-lg border border-[#ebe9f5]"
        />
      ))}

      {/* 문제 영상 */}
      {question.video && (
        <video
          src={question.video}
          controls
          className="w-full rounded-lg border border-[#ebe9f5]"
        />
      )}

      <div className="space-y-2">
        {question.choices.map((choice) => (
          <AnswerButton
            key={choice.id}
            choice={choice}
            submitted={submitted}
            isAnswer={question.answerIds.includes(choice.id)}
            isSelected={selectedIds.includes(choice.id)}
            onToggle={onToggle}
          />
        ))}
      </div>

      {submitted && (
        <div className="space-y-3 rounded-lg border border-[#ebe9f5] bg-[#f5f4fb] p-4">
          <div>
            <p className="text-xs font-medium text-slate-400">해설</p>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              {question.explanation}
            </p>
          </div>
          {question.explanationImages?.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt="해설 이미지"
              className="mx-auto block h-auto max-h-96 w-auto max-w-full rounded-lg border border-[#ebe9f5]"
            />
          ))}
        </div>
      )}
    </Card>
  );
}
