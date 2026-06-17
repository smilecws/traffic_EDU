import { ProgressBar } from "@/components/shared/ProgressBar";

export interface QuizProgressProps {
  /** 현재 문제 번호 (1-based) */
  current: number;
  /** 전체 문제 수 */
  total: number;
}

/** "n / 40" 텍스트 + 진행 막대. */
export function QuizProgress({ current, total }: QuizProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>진행도</span>
        <span className="tabular-nums font-mono">
          {current} / {total}
        </span>
      </div>
      <ProgressBar value={current} max={total} />
    </div>
  );
}
