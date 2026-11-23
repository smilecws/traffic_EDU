"use client";

import { useState, useSyncExternalStore } from "react";
import { Ticket } from "lucide-react";
import {
  getAdminBranch,
  getIssuedCodesServerSnapshot,
  getIssuedCodesSnapshot,
  issueGroupCode,
  normalizeBranchSlug,
  saveAdminBranch,
  saveIssuedCode,
  subscribeIssuedCodes,
  type IssuedGroupCode,
} from "@/lib/services/groupCodeService";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { cn } from "@/lib/utils/cn";
import { GroupLinkCard } from "./GroupLinkCard";

/** epoch ms → "11월 24일 14:30" */
function formatIssuedAt(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 변경 알림이 없는 값(마지막 지점)을 위한 빈 구독. */
const noopSubscribe = () => () => {};

/**
 * 회차 발급 카드 — 지점을 적고 버튼을 누르면 앱이 코드를 만들어 QR까지 띄운다.
 *
 * 손으로 코드를 타이핑하던 방식에서 넘어온 이유는 세 가지다: 같은 날 두 지점이
 * 같은 코드를 써서 통계가 섞이는 충돌, `1124-soeul`처럼 조용히 회차를 쪼개는
 * 오타, 그리고 추측 가능한 코드로 제3자가 응답을 쌓는 오염.
 *
 * 발급 내역은 이 기기(localStorage)에도 남긴다. 달력은 응답이 1건이라도 쌓인
 * 뒤에야 코드를 보여주므로, 발급 직후 새로고침하면 코드를 잃기 때문이다.
 */
export function IssueSessionCard() {
  // localStorage는 외부 저장소로 취급해 구독한다(SSR에서는 빈 값).
  const storedBranch = useSyncExternalStore(
    noopSubscribe,
    getAdminBranch,
    () => "",
  );
  const issued = useSyncExternalStore(
    subscribeIssuedCodes,
    getIssuedCodesSnapshot,
    getIssuedCodesServerSnapshot,
  );

  /** 입력 중인 값. null이면 아직 손대지 않아 저장된 지점을 그대로 쓴다. */
  const [draft, setDraft] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const branch = draft ?? storedBranch;
  const slug = normalizeBranchSlug(branch);

  function handleIssue() {
    const next = issueGroupCode(branch);
    if (!next) {
      setError("지점을 알아볼 수 없습니다. 지역명이나 영문으로 적어 주세요.");
      return;
    }
    const entry: IssuedGroupCode = {
      code: next,
      branch: branch.trim(),
      issuedAt: Date.now(),
    };
    saveIssuedCode(entry);
    saveAdminBranch(branch);
    setCode(next);
    setError(null);
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">회차 발급</h2>
          <p className="text-xs leading-relaxed text-slate-400">
            교육 시작 전에 발급하고 QR을 띄우세요. 코드는 앱이 만듭니다 — 같은
            날 다른 지점과 겹치거나 오타로 통계가 쪼개지지 않습니다.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">지점</span>
          <input
            value={branch}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            placeholder="예: 춘천"
            className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </label>

        {slug && (
          <p className="text-xs text-slate-400">
            발급될 코드 형태:{" "}
            <code className="text-slate-600">{`MMDD-${slug}-***`}</code>
          </p>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={!slug}
          onClick={handleIssue}
        >
          <Ticket size={18} strokeWidth={1.5} />
          회차 발급
        </Button>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </Card>

      <GroupLinkCard code={code} />

      {issued.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">최근 발급</h2>
          <p className="text-xs leading-relaxed text-slate-400">
            이 기기에서 발급한 내역입니다. 누르면 QR을 다시 띄웁니다.
          </p>
          <ul className="space-y-1">
            {issued.map((entry) => (
              <li key={entry.code}>
                <button
                  type="button"
                  onClick={() => setCode(entry.code)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                    entry.code === code
                      ? "border-violet-400 bg-violet-50"
                      : "border-[#ebe9f5] hover:bg-[#f5f4fb]",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <code className="block truncate text-sm text-slate-900">
                      {entry.code}
                    </code>
                    <span className="text-xs text-slate-400">
                      {entry.branch ? `${entry.branch} · ` : ""}
                      {formatIssuedAt(entry.issuedAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
