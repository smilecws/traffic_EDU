"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ListChecks, MessageSquareHeart, Ticket, Trash2 } from "lucide-react";
import {
  getAdminBranch,
  getAdminSurveyFlag,
  normalizeBranchName,
  saveAdminBranch,
  saveAdminSurveyFlag,
} from "@/lib/services/groupCodeService";
import {
  issueSession,
  loadRecentSessions,
  type AdminSession,
} from "@/lib/services/adminSessionService";
import {
  deleteQuestionSet,
  loadQuestionSets,
  type QuestionSet,
} from "@/lib/services/adminQuestionSetService";
import { AdminSessionExpiredError } from "@/lib/services/adminStatsService";
import { useQuestions } from "@/lib/hooks/useQuestions";
import { MAX_PICKS, formatPicks, parsePickInput } from "@/lib/utils/questionPicks";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Spinner } from "@/components/shared/Spinner";
import { cn } from "@/lib/utils/cn";
import { GroupLinkCard } from "./GroupLinkCard";
import { QuestionPickerSheet } from "./QuestionPickerSheet";

/** epoch ms → "11월 24일 14:30" */
function formatIssuedAt(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 변경 알림이 없는 값(마지막 교육반)을 위한 빈 구독. */
const noopSubscribe = () => () => {};

/**
 * 교육반 관리 카드 — 교육반을 적고 버튼을 누르면 서버가 코드를 만들어 QR까지 띄운다.
 *
 * 손으로 코드를 타이핑하던 방식에서 넘어온 이유는 세 가지다: 같은 날 두 교육반이
 * 같은 코드를 써서 통계가 섞이는 충돌, `1124-soeul`처럼 조용히 회차를 쪼개는
 * 오타, 그리고 추측 가능한 코드로 제3자가 응답을 쌓는 오염.
 *
 * 발급과 발급 내역은 **서버의 회차 등록부**가 원본이다. 예전에는 이 기기의
 * localStorage에만 적어 둬서, 기기를 바꾸거나 브라우저 데이터를 지우면 회차가
 * 통째로 사라졌다. 지금은 다른 기기에서 로그인해도 같은 목록이 보인다.
 *
 * 발급 시점에 고정되는 것이 둘 있다 — 만족도 조사 여부와 지정 출제 문제.
 * 둘 다 **이미 발급한 QR의 내용을 나중에 바꿀 수 없어야** 하기 때문이다.
 */
export function IssueSessionCard({
  onSessionExpired,
}: {
  onSessionExpired?: () => void;
}) {
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

  /** 입력 중인 값. null이면 아직 손대지 않아 저장된 교육반을 그대로 쓴다. */
  const [draft, setDraft] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** 만족도 조사 체크. null이면 지난번 설정을 그대로 쓴다. */
  const [surveyDraft, setSurveyDraft] = useState<boolean | null>(null);
  const survey = surveyDraft ?? storedSurvey;

  /**
   * 지정 출제 체크와 고른 문제.
   *
   * 설문 체크와 달리 **기억하지 않는다**(매번 꺼진 상태로 시작한다). 지난 교육의
   * 문제 목록이 남아 있다가 교수자가 모르는 채로 다시 출제되면, 교육생은 엉뚱한
   * 문제를 풀고 회차 통계는 비교할 수 없게 된다. 다시 고르는 수고는 세트
   * 보관함이 덜어 준다 — 목록에서 한 번 누르면 끝이다.
   */
  const [assign, setAssign] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  /** 번호 직접 입력 — 종이에 번호를 추려 온 경우가 가장 빠른 길이다. */
  const [manual, setManual] = useState("");
  const [manualNotice, setManualNotice] = useState<string | null>(null);

  /** 세트 보관함. 지정 출제를 켤 때 처음 한 번 읽는다. */
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [setsLoaded, setSetsLoaded] = useState(false);
  const [setsError, setSetsError] = useState<string | null>(null);

  const branch = draft ?? storedBranch;
  /** 저장될 이름 — 비어 있어도 된다(발급을 막지 않는다). */
  const branchName = normalizeBranchName(branch);

  // 문제 전문 — 고르기 시트가 쓴다. 통계 화면과 같은 캐시를 공유한다.
  const { data: questions, isLoading: questionsLoading } = useQuestions();

  /** 서버에서 읽은 발급 내역. */
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const expire = useCallback(
    (err: unknown): boolean => {
      if (err instanceof AdminSessionExpiredError) {
        onSessionExpired?.();
        return true;
      }
      return false;
    },
    [onSessionExpired],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await loadRecentSessions();
        if (!cancelled) setSessions(list);
      } catch (err) {
        if (cancelled || expire(err)) return;
        setListError(
          err instanceof Error ? err.message : "발급 내역을 불러오지 못했습니다.",
        );
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expire]);

  // 세트 보관함은 **지정 출제를 켤 때** 읽는다. 쓰지 않는 교수자에게 요청을
  // 한 번 더 보낼 이유가 없다.
  useEffect(() => {
    if (!assign || setsLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await loadQuestionSets();
        if (!cancelled) setSets(list);
      } catch (err) {
        if (cancelled || expire(err)) return;
        setSetsError(
          err instanceof Error ? err.message : "세트를 불러오지 못했습니다.",
        );
      } finally {
        if (!cancelled) setSetsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assign, setsLoaded, expire]);

  /**
   * 화면에 뜬 QR이 설문을 포함하는지, 지정 출제가 몇 문제인지는 **발급 당시
   * 기록**에서 읽는다. 지금 체크박스를 켜고 끄는 것이 이미 발급한 QR을 바꿔선
   * 안 된다 — 교육생이 이미 스캔한 링크와 달라진다.
   */
  const shown = sessions.find((entry) => entry.code === code);
  const shownSurvey = shown?.survey ?? false;
  const shownPickCount = shown?.picks.length ?? 0;

  /** 지정 출제를 켰는데 문제를 고르지 않았으면 발급을 막는다. */
  const missingPicks = assign && picks.length === 0;

  /**
   * 번호 직접 입력을 선택 목록으로 옮긴다.
   *
   * 못 읽은 토큰과 **문제은행에 없는 번호**를 반드시 알려 준다. 출제 단계는
   * 없는 id를 조용히 건너뛰므로(`buildQuizQuestions`), 여기서 잡지 않으면
   * "20문제를 지정했는데 18문제만 나오는" 실패가 교육장에서야 드러난다.
   */
  function applyManual() {
    const { picks: parsed, invalid, truncated } = parsePickInput(manual);

    // 문제 데이터가 아직 안 왔으면 존재 확인을 건너뛰지 않고 기다리게 한다.
    if (!questions) {
      setManualNotice("문제 데이터를 불러오는 중입니다. 잠시 후 다시 눌러 주세요.");
      return;
    }

    const known = new Set(questions.map((q) => q.id));
    const found = parsed.filter((id) => known.has(id));
    const missing = parsed.filter((id) => !known.has(id));

    if (found.length === 0) {
      setManualNotice(
        missing.length > 0
          ? `문제은행에 없는 번호입니다: ${missing.join(", ")}`
          : "번호를 읽지 못했습니다. 예: 12, 45, 101-110 처럼 적어 주세요.",
      );
      return;
    }

    setPicks(found);
    const notes = [`${found.length}문제를 인식했습니다.`];
    if (missing.length > 0) {
      notes.push(`문제은행에 없어 제외: ${missing.join(", ")}`);
    }
    if (invalid.length > 0) notes.push(`읽지 못한 값: ${invalid.join(", ")}`);
    if (truncated) notes.push(`상한 ${MAX_PICKS}문제까지만 담았습니다.`);
    setManualNotice(notes.join(" "));
  }

  /** 세트를 지운다 — 이미 발급된 회차의 출제 내용은 영향받지 않는다. */
  async function handleDeleteSet(id: string) {
    try {
      await deleteQuestionSet(id);
      setSets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      if (expire(err)) return;
      setSetsError(
        err instanceof Error ? err.message : "세트를 지우지 못했습니다.",
      );
    }
  }

  async function handleIssue() {
    if (busy || missingPicks) return;
    setBusy(true);
    setError(null);
    try {
      const issued = await issueSession({
        branch: branchName,
        survey,
        // 체크를 끄면 목록이 남아 있어도 보내지 않는다.
        picks: assign ? picks : [],
      });
      setSessions((prev) => [
        issued,
        ...prev.filter((e) => e.code !== issued.code),
      ]);
      setCode(issued.code);
      saveAdminBranch(branch);
      saveAdminSurveyFlag(survey);
      setListError(null);
    } catch (err) {
      if (expire(err)) return;
      setError(
        err instanceof Error ? err.message : "회차를 발급하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">교육반 관리</h2>
          <p className="text-xs leading-relaxed text-slate-400">
            교육 시작 전에 발급하고 QR을 띄우세요. 코드는 서버가 만듭니다 — 같은
            날 다른 회차와 겹치거나 오타로 통계가 쪼개지지 않습니다.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">
            교육반 · 교수자{" "}
            <span className="font-normal text-slate-400">(선택)</span>
          </span>
          <input
            value={branch}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            placeholder="예: 음주반 / 홍길동 교수자"
            className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </label>

        <p className="text-xs leading-relaxed text-slate-400">
          나중에 목록에서 알아보기 위한 메모입니다. 비워도 발급됩니다 — 회차를
          구분하는 것은 코드입니다.
        </p>

        {/* 설문 여부는 발급 시점에 고정된다 — 서버 회차 기록에 함께 적힌다. */}
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

        {/* 지정 출제도 발급 시점에 고정된다(설문과 같은 구조). */}
        <div
          className={cn(
            "rounded-xl border transition-colors",
            assign ? "border-violet-300 bg-violet-50/40" : "border-[#ebe9f5]",
          )}
        >
          <label className="flex cursor-pointer items-start gap-2.5 p-3">
            <input
              type="checkbox"
              checked={assign}
              onChange={(e) => {
                setAssign(e.target.checked);
                setError(null);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                <ListChecks size={15} strokeWidth={1.5} />
                지정한 문제만 출제하기
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                이 QR로 들어온 교육생 홈 맨 위에 &ldquo;이번 교육 문제&rdquo;
                카드가 생깁니다. 다른 메뉴는 그대로 보입니다.
              </span>
            </span>
          </label>

          {assign && (
            <div className="space-y-3 border-t border-violet-200/70 p-3">
              {/* 고른 문제 요약 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600">
                    {picks.length === 0
                      ? "고른 문제가 없습니다"
                      : `${picks.length}문제 선택`}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={questionsLoading || !questions}
                    onClick={() => setPickerOpen(true)}
                  >
                    {questionsLoading ? "문제 로드 중…" : "문제 고르기"}
                  </Button>
                </div>
                {picks.length > 0 && (
                  <p className="break-words text-xs leading-relaxed text-slate-400">
                    {formatPicks(picks)}번
                  </p>
                )}
              </div>

              {/* 세트 보관함 */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">
                  저장한 세트
                </span>
                {!setsLoaded && (
                  <div className="flex justify-center py-3">
                    <Spinner label="세트를 불러오는 중" />
                  </div>
                )}
                {setsLoaded && setsError && (
                  <p className="text-xs text-red-500">{setsError}</p>
                )}
                {setsLoaded && !setsError && sets.length === 0 && (
                  <p className="text-xs text-slate-400">
                    아직 저장한 세트가 없습니다. 문제를 고른 뒤 이름을 붙여
                    저장하면, 다음 교육에서는 여기서 바로 고를 수 있습니다.
                  </p>
                )}
                {sets.length > 0 && (
                  <ul className="space-y-1">
                    {sets.map((item) => (
                      <li key={item.id} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPicks(item.picks);
                            setManualNotice(null);
                          }}
                          className="min-w-0 flex-1 rounded-xl border border-[#ebe9f5] bg-white px-3 py-2 text-left transition-colors hover:bg-[#f5f4fb]"
                        >
                          <span className="block truncate text-sm text-slate-900">
                            {item.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {item.picks.length}문제
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`${item.name} 세트 지우기`}
                          onClick={() => void handleDeleteSet(item.id)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#ebe9f5] bg-white text-slate-400 transition-colors hover:bg-[#f5f4fb] hover:text-red-500"
                        >
                          <Trash2 size={15} strokeWidth={1.5} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 번호 직접 입력 */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">
                  번호로 입력{" "}
                  <span className="font-normal text-slate-400">
                    (종이에 추려 왔을 때)
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    placeholder="예: 12, 45, 101-110"
                    aria-label="지정 문제 번호"
                    className="min-w-0 flex-1 rounded-xl border border-[#ebe9f5] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!manual.trim()}
                    onClick={applyManual}
                  >
                    적용
                  </Button>
                </div>
                {manualNotice && (
                  <p className="text-xs leading-relaxed text-slate-500">
                    {manualNotice}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={busy || missingPicks}
          onClick={() => void handleIssue()}
        >
          <Ticket size={18} strokeWidth={1.5} />
          {busy ? "발급 중…" : "교육반 발급"}
        </Button>

        {missingPicks && (
          <p className="text-xs text-amber-600">
            지정 출제를 켰습니다 — 출제할 문제를 고른 뒤 발급해 주세요.
          </p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </Card>

      <GroupLinkCard
        code={code}
        survey={shownSurvey}
        pickCount={shownPickCount}
      />

      <Card className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">최근 발급</h2>
        <p className="text-xs leading-relaxed text-slate-400">
          서버에 등록된 회차입니다. 기기를 바꿔도 그대로 보이고, 누르면 QR을 다시
          띄웁니다.
        </p>

        {listLoading && (
          <div className="flex justify-center py-6">
            <Spinner label="불러오는 중" />
          </div>
        )}

        {!listLoading && listError && (
          <p className="text-sm text-red-500">{listError}</p>
        )}

        {!listLoading && !listError && sessions.length === 0 && (
          <p className="text-xs text-slate-400">아직 발급한 회차가 없습니다.</p>
        )}

        {sessions.length > 0 && (
          <ul className="space-y-1">
            {sessions.map((entry) => (
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
                      {entry.survey
                        ? ` · 설문 ${entry.surveyCount}건`
                        : ""}
                      {entry.picks.length > 0
                        ? ` · 지정 ${entry.picks.length}문제`
                        : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/*
        문제 고르기 — 열려 있을 때만 마운트한다. 1000문항 목록을 닫힌 동안
        계산하지 않고, 다시 열 때 선택 상태가 현재 picks에서 새로 시작한다.
      */}
      {pickerOpen && (
        <QuestionPickerSheet
          open
          onClose={() => setPickerOpen(false)}
          questions={questions ?? []}
          initialPicks={picks}
          onConfirm={(next) => {
            setPicks(next);
            setManualNotice(null);
          }}
          onSaved={(saved) => setSets((prev) => [saved, ...prev])}
          onSessionExpired={onSessionExpired}
        />
      )}
    </div>
  );
}
