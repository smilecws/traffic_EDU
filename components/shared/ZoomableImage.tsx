"use client";

import { useEffect, useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ZoomableImageProps {
  src: string;
  /** 대체 텍스트 — 확대 화면의 aria-label에도 쓰인다. */
  alt: string;
  /** 축소 표시 상태의 최대 높이 등 추가 클래스 (예: "max-h-96") */
  className?: string;
}

/**
 * 누르면 전체 화면으로 확대되는 이미지.
 *
 * 문제 이미지 원본은 71px~4624px로 치수가 제각각이어서 본문에서는 확대하지 않고
 * 최대 높이만 제한한다(강제로 늘리면 작은 그림이 흐려진다). 그 결과 큰 표지판·
 * 교차로 그림은 축소돼 세부가 안 보이므로, 탭/클릭하면 원본 크기까지 볼 수 있는
 * 확대 화면을 띄운다.
 */
export function ZoomableImage({ src, alt, className }: ZoomableImageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt} 확대`}
        className="group relative mx-auto block w-fit max-w-full cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={cn(
            "block h-auto w-auto max-w-full rounded-lg border border-[#ebe9f5]",
            className,
          )}
        />
        <span
          aria-hidden="true"
          className="absolute bottom-2 right-2 rounded-md bg-slate-900/60 p-1.5 text-white"
        >
          <ZoomIn size={16} strokeWidth={2} />
        </span>
      </button>

      {open && (
        <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/** 전체 화면 확대 오버레이 — 화면 맞춤 ↔ 원본 크기를 번갈아 보여준다. */
function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [actualSize, setActualSize] = useState(false);

  // 열려 있는 동안만 ESC 리스너를 걸고, 닫히면 해제한다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // 뒤 페이지가 같이 스크롤되지 않게 막고, 닫힐 때 원래대로 돌린다.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} 확대 보기`}
      className="fixed inset-0 z-50 bg-black/90 animate-[fade-in_0.2s_ease-in]"
      onClick={onClose}
    >
      {/* 원본 크기 모드에서 이미지가 화면보다 커지면 이 영역을 스크롤해 둘러본다.
          내부 래퍼의 min-w/min-h-full 덕에 작은 이미지는 가운데 정렬되고,
          큰 이미지는 가장자리까지 스크롤이 닿는다. */}
      <div className="absolute inset-0 overflow-auto overscroll-contain">
        <div className="flex min-h-full min-w-full items-center justify-center p-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActualSize((v) => !v);
            }}
            aria-label={actualSize ? "화면 크기에 맞추기" : "원본 크기로 보기"}
            className={cn(
              "block",
              actualSize ? "cursor-zoom-out" : "cursor-zoom-in",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className={
                actualSize
                  ? "block h-auto w-auto max-w-none"
                  : "block max-h-[85vh] max-w-full object-contain"
              }
            />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="확대 닫기"
        className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X size={20} strokeWidth={2} />
      </button>

      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs text-white/70">
        {actualSize
          ? "이미지를 누르면 화면에 맞춥니다"
          : "이미지를 누르면 원본 크기로 봅니다"}
      </p>
    </div>
  );
}
