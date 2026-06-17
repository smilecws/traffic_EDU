import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "neutral" | "success" | "danger" | "warning" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-500/15 text-emerald-500",
  danger: "bg-red-500/15 text-red-500",
  warning: "bg-amber-500/15 text-amber-500",
  info: "bg-blue-500/15 text-blue-500",
};

/** 상태/주제 라벨. UI_GUIDE 시맨틱 색상. */
export function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
