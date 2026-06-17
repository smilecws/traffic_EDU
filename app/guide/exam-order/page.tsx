"use client";

import { Globe } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { IconTile, type TileColor } from "@/components/shared/IconTile";
import { ExternalLinkRow } from "@/components/shared/ExternalLinkRow";
import {
  LICENSE_EXAM_STEPS,
  LICENSE_EXAM_SOURCE,
} from "@/lib/data/licenseExamSteps";

// IconTile 7색 순환 (green→violet→indigo→rose→amber→blue→teal→…)
const TILE_COLORS: TileColor[] = [
  "green",
  "violet",
  "indigo",
  "rose",
  "amber",
  "blue",
  "teal",
];

export default function ExamOrderGuidePage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
      <PageHeader title="면허시험 순서" />

      <p className="text-sm text-slate-500 leading-relaxed">
        운전면허 취득은 아래 7단계 절차로 진행됩니다.
      </p>

      <section className="space-y-3">
        {LICENSE_EXAM_STEPS.map((s, i) => (
          <article
            key={s.step}
            className="rounded-2xl bg-white border border-[#ebe9f5] p-4 shadow-sm"
          >
            <div className="flex gap-3">
              <IconTile color={TILE_COLORS[i % TILE_COLORS.length]} size="sm">
                <span className="text-sm font-semibold tabular-nums">
                  {String(s.step).padStart(2, "0")}
                </span>
              </IconTile>
              <div className="flex-1 space-y-2">
                <h2 className="text-base font-semibold text-slate-900">
                  {s.title}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {s.description}
                </p>
                {s.prepare && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-400">준비물</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.prepare.map((item) => (
                        <span
                          key={item}
                          className="rounded-lg bg-[#f5f4fb] border border-[#ebe9f5] px-2 py-1 text-xs text-slate-600"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {s.note && (
                  <div className="rounded-lg bg-[#f5f4fb] border border-[#ebe9f5] p-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {s.note}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* 출처 */}
      <section className="space-y-2">
        <p className="text-xs font-medium text-slate-400">출처</p>
        <ExternalLinkRow
          icon={<Globe size={24} strokeWidth={1.5} />}
          color="blue"
          title={LICENSE_EXAM_SOURCE.label}
          subtitle={LICENSE_EXAM_SOURCE.subtitle}
          href={LICENSE_EXAM_SOURCE.url}
        />
      </section>
    </main>
  );
}
