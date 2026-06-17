"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * 하단에서 올라오는 모달 시트. 백드롭 + 불투명 흰색 패널.
 * 데이터 접근 없음 — 열림 상태/내용은 사용하는 페이지가 넘긴다.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: BottomSheetProps) {
  // open인 동안만 ESC 리스너 등록, 언마운트/닫힘 시 cleanup.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-[fade-in_0.3s_ease-in]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white px-4 pb-6 pt-3 animate-[slide-up_0.4s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-300" />
        {(title || subtitle) && (
          <div className="mt-3">
            {title && (
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            )}
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
