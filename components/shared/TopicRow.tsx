import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconTile, type TileColor } from "./IconTile";

export interface TopicRowProps {
  /** 1-based. "01" 형태로 zero-pad 표시 */
  index: number;
  color: TileColor;
  title: string;
  /** 미지정이면 정적 */
  onClick?: () => void;
}

const rowStyles =
  "flex w-full items-center gap-3 rounded-2xl border border-[#ebe9f5] bg-white p-4 text-left";

/** 번호 뱃지 + 제목 + chevron(›). 학습하기 주제 리스트 행. */
export function TopicRow({ index, color, title, onClick }: TopicRowProps) {
  const label = String(index).padStart(2, "0");
  const content = (
    <>
      <IconTile color={color} size="sm">
        <span className="text-sm font-semibold tabular-nums">{label}</span>
      </IconTile>
      <span className="flex-1 text-base font-semibold text-slate-900">
        {title}
      </span>
      <ChevronRight size={20} strokeWidth={1.5} className="text-slate-400" />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(rowStyles, "transition-shadow hover:shadow-md")}
      >
        {content}
      </button>
    );
  }

  return <div className={rowStyles}>{content}</div>;
}
