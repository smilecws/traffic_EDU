"use client";

import { useState, useSyncExternalStore } from "react";
import { MessageSquareHeart, Ticket } from "lucide-react";
import {
  getAdminBranch,
  getAdminSurveyFlag,
  getIssuedCodesServerSnapshot,
  getIssuedCodesSnapshot,
  issueGroupCode,
  normalizeBranchSlug,
  saveAdminBranch,
  saveAdminSurveyFlag,
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
 * 교육반 관리 카드 — 교육반을 적고 버튼을 누르면 앱이 코드를 만들어 QR까지 띄운다.
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
  const storedSurvey = useSyncExternalStore(
    noopSubscribe,
    getAdminSurveyFlag,
    () => false,
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

  /** 만족도 조사 체크. null이면 지난번 설정을 그대로 쓴다. */
  const [surveyDraft, setSurveyDraft] = useState<boolean | null>(null);
  const survey = surveyDraft ?? storedSurvey;

  const branch = draft ?? storedBranch;
  const slug = normalizeBranchSlug(branch);

  /**
   * 화면에 뜬 QR이 설문을 포함하는지는 **발급 당시 기록**에서 읽는다.
   * 지금 체크박스를 켜고 끄는 것이 이미 발급한 QR을 바꿔선 안 된다 —
   * 교육생이 이미 스캔한 링크와 달라진다.
   */
  const shownSurvey =
    issued.find((entry) => entry.code === code)?.survey ?? false;

  function handleIssue() {
    const next = issueGroupCode(branch);
    if (!next) {
      setError("교육반을 알아볼 수 없습니다. 교육반 이름이나 영문으로 적어 주세요.");
      return;
    }
    const entry: IssuedGroupCode = {
      code: next,
      branch: branch.trim(),
      issuedAt: Date.now(),
      survey,
    };
    saveIssuedCode(entry);
    saveAdminBranch(branch);
    saveAdminSurveyFlag(survey);
    setCode(next);
    setError(null);
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">교육반 관리</h2>
          <p className="text-xs leading-relaxed text-slate-400">
            교육 시작 전에 발급하고 QR을 띄우세요. 코드는 앱이 만듭니다 — 같은
            날 다른 교육반과 겹치거나 오타로 통계가 쪼개지지 않습니다.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">교육반</span>
          <input
            value={branch}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            placeholder="예: 음주, 교수자"
            className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </label>

        {slug && (
          <p className="text-xs text-slate-400">
            발급될 코드 형태:{" "}
            <code className="text-slate-600">{`MMDD-${slug}-***`}</code>
          </p>
        )}

        {/* 설문 여부는 발급 시점에 고정된다 — QR 링크에 들어가기 때문이다. */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#ebe9f5] p-3 transition-colors hover:bg-[#f5f4fb]">
          <input
            type="checkbox"
            checked={survey}
            onChange={(e) => setSurveyDraft(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
              <MessageSquareHeart size={15} strokeWidth={1.5} />
              만족도 조사 함께 받기
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
              이 QR로 들어온 교육생 화면에 만족도 조사 버튼이 생깁니다. 응답하면
              버튼이 &ldquo;이미 응답하셨습니다&rdquo;로 바뀝니다.
            </span>
          </span>
        </label>

        <Button
          size="lg"
          className="w-full"
          disabled={!slug}
          onClick={handleIssue}
        >
          <Ticket size={18} strokeWidth={1.5} />
          교육반 발급
        </Button>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </Card>

      <GroupLinkCard code={code} survey={shownSurvey} />

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
                      {entry.survey ? " · 설문" : ""}
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
