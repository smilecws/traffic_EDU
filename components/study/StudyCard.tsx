import { Check } from "lucide-react";
import type { StudyCard } from "@/lib/types/study";
import { IconTile } from "@/components/shared/IconTile";
import { cn } from "@/lib/utils/cn";
import { ComparisonTable } from "./ComparisonTable";

interface StudyCardProps {
  card: StudyCard;
}

// badge.code 자유 태그 → pill 색 매핑. 매핑에 없으면 기본 slate.
const codeStyles: Record<string, string> = {
  법: "bg-blue-500/15 text-blue-500",
  법규: "bg-blue-500/15 text-blue-500",
  규칙: "bg-blue-500/15 text-blue-500",
  RULE: "bg-blue-500/15 text-blue-500",
  처벌: "bg-red-500/15 text-red-500",
  PENALTY: "bg-red-500/15 text-red-500",
  범칙금: "bg-red-500/15 text-red-500",
  안전: "bg-emerald-500/15 text-emerald-500",
  안전운전: "bg-emerald-500/15 text-emerald-500",
  사고예방: "bg-emerald-500/15 text-emerald-500",
  개념: "bg-violet-500/15 text-violet-500",
  정의: "bg-violet-500/15 text-violet-500",
  범위: "bg-violet-500/15 text-violet-500",
  SCOPE: "bg-violet-500/15 text-violet-500",
};

const DEFAULT_CODE_STYLE = "bg-slate-100 text-slate-600";

export function StudyCard({ card }: StudyCardProps) {
  const code = card.badge?.code;
  const keyPoints = card.key_points ?? [];
  const tables = card.comparison_tables ?? [];

  return (
    <article className="rounded-2xl bg-white border border-[#ebe9f5] p-4 shadow-sm space-y-3">
      {/* 헤더: 번호 뱃지 + 제목/라벨/코드 태그 */}
      <div className="flex gap-3">
        <IconTile color="violet" size="sm" className="text-sm font-semibold tabular-nums">
          {card.number}
        </IconTile>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            {card.label && (
              <p className="text-xs text-slate-400">{card.label}</p>
            )}
            {code && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  codeStyles[code] ?? DEFAULT_CODE_STYLE,
                )}
              >
                {code}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {card.title}
          </h3>
          {card.subtitle && (
            <p className="text-sm text-slate-500">{card.subtitle}</p>
          )}
        </div>
      </div>

      {/* 본문 */}
      {card.body && (
        <p className="text-sm text-slate-600 leading-relaxed">{card.body}</p>
      )}

      {/* 핵심 포인트 */}
      {keyPoints.length > 0 && (
        <div className="rounded-lg bg-[#f5f4fb] border border-[#ebe9f5] p-3">
          <ul className="space-y-1.5">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <Check
                  size={16}
                  strokeWidth={1.5}
                  className="mt-0.5 shrink-0 text-violet-500"
                />
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 비교표 */}
      {tables.length > 0 && (
        <div className="space-y-3">
          {tables.map((table, i) => (
            <ComparisonTable
              key={i}
              headers={table.headers}
              rows={table.rows}
            />
          ))}
        </div>
      )}
    </article>
  );
}
