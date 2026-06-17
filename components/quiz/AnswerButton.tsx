import { Check, X } from "lucide-react";
import type { Choice } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

export interface AnswerButtonProps {
  choice: Choice;
  /** 제출(채점)했는지 — 제출 후에는 정답/오답 피드백을 표시 */
  submitted: boolean;
  /** 이 선택지가 정답인지 */
  isAnswer: boolean;
  /** 사용자가 이 선택지를 골랐는지 */
  isSelected: boolean;
  onToggle: (id: number) => void;
}

/**
 * 복수 선택 선택지 버튼.
 * - 제출 전: 탭하면 선택/해제 토글. 선택된 항목은 violet 강조.
 * - 제출 후: 정답=emerald, 내가 고른 오답=red, 나머지=dim.
 */
export function AnswerButton({
  choice,
  submitted,
  isAnswer,
  isSelected,
  onToggle,
}: AnswerButtonProps) {
  const showCorrect = submitted && isAnswer;
  const showWrong = submitted && isSelected && !isAnswer;

  return (
    <button
      type="button"
      disabled={submitted}
      onClick={() => onToggle(choice.id)}
      aria-pressed={isSelected}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-default",
        !submitted &&
          !isSelected &&
          "border-[#ebe9f5] bg-white text-slate-900 hover:border-violet-300 hover:bg-[#f5f4fb]",
        !submitted &&
          isSelected &&
          "border-violet-400 bg-violet-50 text-violet-700",
        showCorrect && "border-emerald-400 bg-emerald-50 text-emerald-700",
        showWrong && "border-red-400 bg-red-50 text-red-700",
        submitted && !showCorrect && !showWrong && "border-[#ebe9f5] bg-[#f5f4fb] text-slate-400",
      )}
    >
      <span>{choice.text}</span>
      {/* 제출 전 선택 표시 / 제출 후 정답·오답 아이콘 */}
      {!submitted && isSelected && (
        <Check strokeWidth={1.5} className="h-5 w-5 shrink-0" />
      )}
      {showCorrect && <Check strokeWidth={1.5} className="h-5 w-5 shrink-0" />}
      {showWrong && <X strokeWidth={1.5} className="h-5 w-5 shrink-0" />}
    </button>
  );
}
