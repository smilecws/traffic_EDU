import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * clsx + tailwind-merge 결합 헬퍼.
 * 조건부 클래스를 합치고, 충돌하는 Tailwind 유틸리티는 뒤쪽이 이긴다.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
