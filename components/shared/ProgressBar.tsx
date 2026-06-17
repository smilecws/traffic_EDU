import { cn } from "@/lib/utils/cn";

export interface ProgressBarProps {
  /** 현재 값 */
  value: number;
  /** 최댓값 (기본 100) */
  max?: number;
  className?: string;
}

/** UI_GUIDE 진행 표시기. violet→indigo 그라데이션 채움. */
export function ProgressBar({ value, max = 100, className }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(Math.max(value / safeMax, 0), 1);
  const percent = Math.round(ratio * 100);

  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-[#ebe9f5]", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={safeMax}
    >
      <div
        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
