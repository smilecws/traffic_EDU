"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Copy, Check } from "lucide-react";
import { buildGroupLink, normalizeGroupCode } from "@/lib/services/groupCodeService";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";

export interface GroupLinkCardProps {
  code: string;
  /** 만족도 조사를 함께 받는 회차인지 — 링크에 `&s=1`이 붙는다. */
  survey?: boolean;
}

/**
 * 교육생 배포용 링크·QR 생성 카드.
 * 교육장에서 이 QR을 띄우면, 스캔해 들어온 응답만 해당 회차로 집계된다.
 */
export function GroupLinkCard({ code, survey = false }: GroupLinkCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  // SSR에서는 빈 문자열, 클라이언트에서만 실제 origin을 읽는다(하이드레이션 안전).
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  const normalized = normalizeGroupCode(code);
  const link =
    normalized && origin
      ? buildGroupLink(origin, normalized, { survey })
      : "";

  // 링크가 바뀔 때마다 QR을 다시 그린다(캔버스 렌더 — 외부 요청 없음).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !link) return;
    let cancelled = false;
    void (async () => {
      const QRCode = (await import("qrcode")).default;
      if (cancelled) return;
      await QRCode.toCanvas(canvas, link, { width: 200, margin: 1 });
    })();
    return () => {
      cancelled = true;
    };
  }, [link]);

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 차단 환경 — 링크는 화면에 그대로 떠 있으므로 수동 복사 가능
    }
  }

  if (!normalized) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          회차를 발급하면 교육생 배포용 링크와 QR이 여기에 표시됩니다.
          <br />
          <span className="text-xs text-slate-400">
            발급 코드 형식: <code>MMDD-랜덤6자</code> (예: 1124-7k2m9p)
          </span>
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">
        교육생 배포용 링크 · QR
      </h2>

      <div className="flex justify-center rounded-xl bg-white py-2">
        <canvas ref={canvasRef} aria-label={`${normalized} 회차 참여 QR`} />
      </div>

      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-[#f5f4fb] px-3 py-2 text-xs text-slate-700">
          {link}
        </code>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
          {copied ? "복사됨" : "복사"}
        </Button>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        이 링크로 들어온 기기의 응답만 <b>{normalized}</b> 회차로 집계됩니다.
        회차 표시는 당일 자정에 자동 해제됩니다.
        {survey && " 교육생 홈 화면에 만족도 조사 버튼이 함께 뜹니다."}
      </p>
    </Card>
  );
}
