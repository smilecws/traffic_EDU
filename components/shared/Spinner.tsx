import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SpinnerProps {
  className?: string;
  /** 접근성 라벨 */
  label?: string;
}

/** 로딩 인디케이터. UI_GUIDE에서 유일하게 허용되는 회전 애니메이션. */
export function Spinner({ className, label = "로딩 중" }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <Loader2
        strokeWidth={1.5}
        className={cn("h-5 w-5 animate-spin text-slate-400", className)}
      />
    </span>
  );
}
