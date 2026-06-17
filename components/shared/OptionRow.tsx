import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { IconTile, type TileColor } from "./IconTile";

export interface OptionRowProps {
  /** lucide 아이콘 */
  icon: ReactNode;
  color: TileColor;
  title: string;
  subtitle?: string;
  onClick: () => void;
}

/** 아이콘 타일 + 제목/부제 + 화살표(›). 바텀시트/리스트의 탭 가능한 선택 행. */
export function OptionRow({
  icon,
  color,
  title,
  subtitle,
  onClick,
}: OptionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-[#ebe9f5] bg-white p-4 text-left transition-shadow hover:shadow-md"
    >
      <IconTile color={color}>{icon}</IconTile>
      <div className="flex-1">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <ChevronRight size={20} strokeWidth={1.5} className="text-slate-400" />
    </button>
  );
}
