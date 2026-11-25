"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";

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
      {/*
        화면 높이를 넘지 않게 막고 내용만 안에서 스크롤한다. 막지 않으면 내용이
        긴 시트(문제 고르기 등)는 제목과 바깥 영역이 화면 밖으로 밀려나, 휴대폰에서
        닫을 방법이 없어진다. 닫기 버튼은 스크롤과 상관없이 항상 위에 보인다.
      */}
      <div
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-white pb-6 pt-3 animate-[slide-up_0.4s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-300" />
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              )}
              {subtitle && (
                <p className="text-sm text-slate-500">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#f5f4fb] hover:text-slate-700"
            >
              <X size={22} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="mt-4 min-h-0 overflow-y-auto overscroll-contain px-4">
          {children}
        </div>
      </div>
    </div>
  );
}
