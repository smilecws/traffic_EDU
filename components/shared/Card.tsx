import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type CardProps = HTMLAttributes<HTMLDivElement>;

/**
 * 카드 컨테이너. UI_GUIDE 라이트 카드 스타일(rounded-2xl + 흰 배경 + 연한 라벤더 테두리 + shadow-sm).
 */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#ebe9f5] bg-white p-5 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
