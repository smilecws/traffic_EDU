import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  // UI_GUIDE Primary
  primary: "rounded-xl bg-violet-600 text-white hover:bg-violet-700",
  // UI_GUIDE Secondary
  secondary:
    "rounded-xl border border-[#ebe9f5] bg-white text-slate-700 hover:bg-[#f5f4fb]",
  // UI_GUIDE Text 버튼 (장식 없는 텍스트 액션)
  ghost: "text-violet-600 hover:text-violet-700",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

/** UI_GUIDE 버튼 스타일을 따르는 공용 버튼. 클릭 인터랙션만 담당. */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  );
}
