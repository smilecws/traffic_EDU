import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { IconTile, type TileColor } from "./IconTile";

export interface MenuCardProps {
  /** lucide 아이콘 */
  icon: ReactNode;
  color: TileColor;
  title: string;
  subtitle: string;
  /** 우상단 빨강 카운트 뱃지(예: 오답 78). undefined면 미표시 */
  badge?: number;
  /** 미지정이면 비활성(정적) — 클릭 불가 */
  onClick?: () => void;
}

const cardStyles =
  "relative flex flex-col gap-3 rounded-2xl border border-[#ebe9f5] bg-white p-5 text-left shadow-sm";

/** 아이콘 타일 + 제목 + 부제(+선택적 카운트 뱃지). 홈 2×2 / 문제 허브 메뉴 공용. */
export function MenuCard({
  icon,
  color,
  title,
  subtitle,
  badge,
  onClick,
}: MenuCardProps) {
  const content = (
    <>
      {badge !== undefined && (
        <span className="absolute right-3 top-3 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
          {badge}
        </span>
      )}
      <IconTile color={color}>{icon}</IconTile>
      <div>
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(cardStyles, "transition-shadow hover:shadow-md")}
      >
        {content}
      </button>
    );
  }

  return <div className={cardStyles}>{content}</div>;
}
