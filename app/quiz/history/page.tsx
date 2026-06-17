"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/shared/Badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Spinner } from "@/components/shared/Spinner";
import { useMockHistory } from "@/lib/hooks/useMockHistory";

/**
 * 모의고사 이력 — 지난 응시 기록 목록.
 * - 데이터는 useMockHistory 훅(localStorage)만 경유. 페이지에서 직접 접근 없음.
 * - 항목 클릭 시 /result/{id}로 상세 재열람(라우팅만, 결과 데이터는 결과 페이지가 읽음).
 */
export default function MockHistoryPage() {
  const router = useRouter();
  const { data: history, isLoading } = useMockHistory();

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
      <PageHeader title="모의고사 이력" />

      {isLoading || !history ? (
        <div className="flex items-center justify-center py-32">
          <Spinner label="모의고사 이력을 불러오는 중" />
        </div>
      ) : history.length === 0 ? (
        // 빈 상태 — 응시 기록 없음.
        <div className="rounded-2xl bg-white border border-[#ebe9f5] p-5 space-y-4 shadow-sm">
          <p className="text-sm text-slate-500 leading-relaxed">
            아직 응시한 모의고사가 없습니다.
          </p>
          <button
            type="button"
            onClick={() => router.push("/quiz")}
            className="rounded-xl bg-violet-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-violet-700"
          >
            모의고사 보러가기
          </button>
        </div>
      ) : (
        // 목록 — 최신순(useMockHistory가 정렬해 제공).
        <ul className="space-y-2.5">
          {history.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => router.push(`/result/${entry.id}`)}
                className="w-full text-left rounded-2xl bg-white border border-[#ebe9f5] p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-slate-900">
                        {entry.licenseLabel}
                      </span>
                      <Badge variant={entry.passed ? "success" : "danger"}>
                        {entry.passed ? "합격" : "불합격"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 tabular-nums">
                      {entry.scorePercent}점 ({entry.correctCount}/{entry.total})
                      <span className="text-slate-400">
                        {" · "}기준 {entry.passScore}점
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 tabular-nums">
                      {new Date(entry.finishedAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <ChevronRight
                    size={20}
                    strokeWidth={1.5}
                    className="shrink-0 text-slate-400"
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
