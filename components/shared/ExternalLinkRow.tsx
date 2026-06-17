import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconTile, type TileColor } from "./IconTile";

export interface ExternalLinkRowProps {
  /** lucide 아이콘 */
  icon: ReactNode;
  color: TileColor;
  title: string;
  subtitle: string;
  /** 있으면 <a target="_blank">, 없으면 정적 */
  href?: string;
}

const rowStyles =
  "flex w-full items-center gap-3 rounded-2xl border border-[#ebe9f5] bg-white p-4 text-left";

/** 아이콘 타일 + 제목/부제 + 외부 링크 화살표(↗). 홈 하단 "외부 페이지" 행. */
export function ExternalLinkRow({
  icon,
  color,
  title,
  subtitle,
  href,
}: ExternalLinkRowProps) {
  const content = (
    <>
      <IconTile color={color}>{icon}</IconTile>
      <div className="flex-1">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <ArrowUpRight size={20} strokeWidth={1.5} className="text-slate-400" />
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(rowStyles, "transition-shadow hover:shadow-md")}
      >
        {content}
      </a>
    );
  }

  return <div className={rowStyles}>{content}</div>;
}
