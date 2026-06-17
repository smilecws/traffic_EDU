import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** 아이콘 타일 카테고리 색. UI_GUIDE "아이콘 타일 그라데이션" 표. */
export type TileColor =
  | "green"
  | "violet"
  | "indigo"
  | "rose"
  | "amber"
  | "blue"
  | "teal";

export interface IconTileProps {
  color: TileColor;
  /** sm: h-9 w-9(번호/작은 타일), md: h-11 w-11(기본) */
  size?: "sm" | "md";
  className?: string;
  /** lucide 아이콘 또는 숫자 */
  children: ReactNode;
}

// 리터럴 매핑 — 동적 `from-${color}-400` 금지(Tailwind JIT가 purge 못 함).
const colorStyles: Record<TileColor, string> = {
  green: "from-emerald-400 to-emerald-500",
  violet: "from-violet-400 to-violet-500",
  indigo: "from-indigo-400 to-indigo-500",
  rose: "from-rose-400 to-rose-500",
  amber: "from-amber-400 to-orange-500",
  blue: "from-blue-400 to-blue-500",
  teal: "from-teal-400 to-teal-500",
};

const sizeStyles: Record<NonNullable<IconTileProps["size"]>, string> = {
  sm: "h-9 w-9 rounded-lg",
  md: "h-11 w-11 rounded-xl",
};

/**
 * 아이콘/숫자를 감싸는 컬러 그라데이션 둥근 사각 타일.
 * 그라데이션은 아이콘 타일/브랜드 면에만 — UI_GUIDE.
 */
export function IconTile({
  color,
  size = "md",
  className,
  children,
}: IconTileProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-gradient-to-br text-white",
        colorStyles[color],
        sizeStyles[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
