"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, ListChecks, Save, Search, TrendingUp } from "lucide-react";
import type { Question } from "@/lib/types";
import { QUESTION_TYPES } from "@/lib/data/questionTypes";
import { MAX_PICKS } from "@/lib/utils/questionPicks";
import {
  AdminSessionExpiredError,
  loadAllStats,
  maxUsableMinAttempts,
} from "@/lib/services/adminStatsService";
import { DEFAULT_CLASSIFIER } from "@/lib/services/questionClassifier";
import {
  saveQuestionSet,
  type QuestionSet,
} from "@/lib/services/adminQuestionSetService";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { Button } from "@/components/shared/Button";
import { Spinner } from "@/components/shared/Spinner";
import { cn } from "@/lib/utils/cn";

/**
 * 한 번에 그리는 문항 수 상한.
 *
 * 1000개를 전부 DOM에 올리면 시트를 열 때마다 눈에 보이게 멈춘다. 교수자는
 * 어차피 검색·유형으로 좁혀서 고르므로, 앞에서 자르고 "더 좁혀 보세요"를
 * 안내하는 쪽이 가볍고 솔직하다.
 */
const VISIBLE_LIMIT = 80;

/** "오답률 상위 N문제로 채우기"의 N 선택지. */
const TOP_COUNTS = [10, 20, 30] as const;

/**
 * 오답률 상위 추천에 쓰는 기본 최소 응답 수.
 *
 * 1~2명만 푼 문항은 오답률이 0%나 100%로 튀어서 순위가 의미를 잃는다. 데이터가
 * 감당하지 못하면 `maxUsableMinAttempts`가 알아서 더 낮춰 준다(통계 화면과 같은 규칙).
 */
const TOP_MIN_ATTEMPTS = 2;

export interface QuestionPickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** 문제 전문 — 관리자 화면이 이미 로드해 둔 것을 그대로 받는다. */
  questions: Question[];
  /** 열 때의 선택 상태(이미 고른 문제들). */
  initialPicks: string[];
  /** 확인을 누르면 고른 목록을 넘긴다(순서 = 출제 순서). */
  onConfirm: (picks: string[]) => void;
  /** 세트로 저장했을 때 — 발급 화면이 목록을 갱신한다. */
  onSaved?: (set: QuestionSet) => void;
  onSessionExpired?: () => void;
}

/**
 * 출제할 문제를 고르는 시트.
 *
 * 1000문제에서 손으로 번호를 떠올려 적는 것은 사실상 불가능하므로, **문제를
 * 보면서 체크하는 것**이 기본 방식이다. 번호를 이미 추려 온 경우를 위한 직접
 * 입력은 발급 화면에 따로 있다.
 *
 * 고른 순서가 출제 순서다 — 체크한 순서를 그대로 보존한다.
 *
 * 선택 상태는 마운트할 때 `initialPicks`로 시작한다. 호출부가 **열릴 때만
 * 마운트**하므로(닫으면 언마운트), 취소하고 다시 열면 바깥의 현재 선택으로
 * 돌아간다 — 이펙트로 state를 되돌리는 것보다 단순하고, 1000문항 목록을
 * 닫혀 있는 동안 계산하지도 않는다.
 */
export function QuestionPickerSheet({
  open,
  onClose,
  questions,
  initialPicks,
  onConfirm,
  onSaved,
  onSessionExpired,
}: QuestionPickerSheetProps) {
  const [selected, setSelected] = useState<string[]>(initialPicks);
  const [query, setQuery] = useState("");
  const [typeValue, setTypeValue] = useState<string | null>(null);
  const [onlySelected, setOnlySelected] = useState(false);

  // 오답률 상위 채우기
  const [topBusy, setTopBusy] = useState(false);
  const [topNotice, setTopNotice] = useState<string | null>(null);

  // 세트로 저장
  const [setName, setSetName] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const questionById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );

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

  /** 검색·유형·선택만 보기를 적용한 목록(번호 오름차순). */
  const filtered = useMemo(() => {
    const q = query.trim();
    const numeric = /^[0-9]+$/.test(q);
    return questions.filter((item) => {
      if (onlySelected && !selectedSet.has(item.id)) return false;
      if (typeValue && item.type !== typeValue) return false;
      if (!q) return true;
      return numeric
        ? String(item.number).startsWith(q)
        : item.question.includes(q);
    });
  }, [questions, query, typeValue, onlySelected, selectedSet]);

  const visible = filtered.slice(0, VISIBLE_LIMIT);
  const hidden = filtered.length - visible.length;
  const atCap = selected.length >= MAX_PICKS;

  /** 체크 토글 — 고른 순서를 보존한다(그게 출제 순서다). */
  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, id];
    });
  };

  /**
   * 오답률 상위 N문제로 선택을 채운다.
   *
   * 집계는 **전체 기간·회차 무관**으로 읽는다. "이 문제은행에서 꾸준히 틀리는
   * 문항"을 뽑는 것이 목적이라 특정 회차로 좁힐 이유가 없다.
   */
  const fillTopWrong = async (count: number) => {
    if (topBusy) return;
    setTopBusy(true);
    setTopNotice(null);
    try {
      const stats = await loadAllStats({
        questions,
        classifier: DEFAULT_CLASSIFIER,
      });
      // 데이터가 얕으면 임계값을 데이터가 감당하는 선까지 낮춘다.
      const usable = maxUsableMinAttempts(stats.questions);
      const min = usable === null ? 1 : Math.min(TOP_MIN_ATTEMPTS, usable);
      // stats.questions는 이미 오답률 내림차순이다.
      const picked = stats.questions
        .filter(
          (s) =>
            s.wrong > 0 && s.attempts >= min && questionById.has(s.questionId),
        )
        .slice(0, Math.min(count, MAX_PICKS))
        .map((s) => s.questionId);

      if (picked.length === 0) {
        setTopNotice(
          "아직 집계된 오답이 없습니다. 교육이 몇 번 돌아 응답이 쌓이면 쓸 수 있습니다.",
        );
        return;
      }

      setSelected(picked);
      setOnlySelected(true);
      setTopNotice(
        picked.length < count
          ? `${picked.length}문제만 담았습니다(${min}명 이상 푼 문항 중 오답이 있는 문제가 그만큼입니다).`
          : `오답률 상위 ${picked.length}문제를 담았습니다(${min}명 이상 푼 문항 기준).`,
      );
    } catch (err) {
      if (expire(err)) return;
      setTopNotice(
        err instanceof Error ? err.message : "집계를 불러오지 못했습니다.",
      );
    } finally {
      setTopBusy(false);
    }
  };

  /** 고른 문제를 이름 붙여 보관함에 저장한다. */
  const handleSave = async () => {
    if (saveBusy) return;
    setSaveBusy(true);
    setSaveNotice(null);
    try {
      const saved = await saveQuestionSet({ name: setName, picks: selected });
      onSaved?.(saved);
      setSetName("");
      setSaveNotice(`"${saved.name}" 세트로 저장했습니다.`);
    } catch (err) {
      if (expire(err)) return;
      setSaveNotice(
        err instanceof Error ? err.message : "세트를 저장하지 못했습니다.",
      );
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="출제할 문제 고르기"
      subtitle={`체크한 순서대로 출제됩니다. 최대 ${MAX_PICKS}문제.`}
    >
      <div className="space-y-3">
        {/* 검색 + 유형 필터 */}
        <div className="relative">
          <Search
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="문제 번호 또는 내용 검색 (예: 음주, 112)"
            aria-label="문제 검색"
            className="w-full rounded-xl border border-[#ebe9f5] py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="전체 유형"
            active={typeValue === null}
            onClick={() => setTypeValue(null)}
          />
          {QUESTION_TYPES.map((t) => (
            <FilterChip
              key={t.value}
              label={t.label}
              active={typeValue === t.value}
              onClick={() => setTypeValue(t.value)}
            />
          ))}
          <FilterChip
            label={`선택만 ${selected.length}`}
            active={onlySelected}
            onClick={() => setOnlySelected((v) => !v)}
          />
        </div>

        {/* 오답률 상위 자동 선택 */}
        <div className="space-y-1.5 rounded-xl border border-[#ebe9f5] p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <TrendingUp size={14} strokeWidth={1.5} />
            오답률 높은 문제로 채우기
          </div>
          <div className="flex items-center gap-1.5">
            {TOP_COUNTS.map((n) => (
              <Button
                key={n}
                variant="secondary"
                size="sm"
                disabled={topBusy}
                onClick={() => void fillTopWrong(n)}
              >
                상위 {n}문제
              </Button>
            ))}
            {topBusy && <Spinner label="집계를 읽는 중" />}
          </div>
          {topNotice && (
            <p className="text-xs leading-relaxed text-slate-500">{topNotice}</p>
          )}
        </div>

        {/* 문항 목록 */}
        <div className="max-h-[42vh] space-y-1 overflow-y-auto">
          {visible.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">
              조건에 맞는 문제가 없습니다.
            </p>
          )}

          {visible.map((item) => {
            const checked = selectedSet.has(item.id);
            return (
              <label
                key={item.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition-colors",
                  checked
                    ? "border-violet-400 bg-violet-50"
                    : "border-[#ebe9f5] hover:bg-[#f5f4fb]",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  // 상한에 닿으면 새로 체크하는 것만 막는다(해제는 계속 가능).
                  disabled={!checked && atCap}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-slate-400 tabular-nums">
                    {item.number}번
                    {checked && ` · 출제 ${selected.indexOf(item.id) + 1}번째`}
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-slate-800">
                    {item.question}
                  </span>
                </span>
              </label>
            );
          })}

          {hidden > 0 && (
            <p className="py-2 text-center text-xs text-slate-400">
              {hidden}문제가 더 있습니다 — 검색이나 유형으로 좁혀 보세요.
            </p>
          )}
        </div>

        {atCap && (
          <p className="text-xs text-amber-600">
            한 회차에 지정할 수 있는 상한({MAX_PICKS}문제)에 닿았습니다.
          </p>
        )}

        {/* 세트로 저장 */}
        <div className="space-y-1.5 rounded-xl border border-[#ebe9f5] p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Save size={14} strokeWidth={1.5} />
            세트로 저장해 다음 교육에 재사용
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="예: 음주반 핵심 20"
              aria-label="세트 이름"
              className="min-w-0 flex-1 rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={saveBusy || selected.length === 0 || !setName.trim()}
              onClick={() => void handleSave()}
            >
              {saveBusy ? "저장 중…" : "저장"}
            </Button>
          </div>
          {saveNotice && (
            <p className="text-xs leading-relaxed text-slate-500">
              {saveNotice}
            </p>
          )}
        </div>

        {/* 확정 */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={selected.length === 0}
            onClick={() => setSelected([])}
          >
            <ListChecks size={18} strokeWidth={1.5} />
            선택 해제
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={() => {
              onConfirm(selected);
              onClose();
            }}
          >
            <Check size={18} strokeWidth={1.5} />
            {selected.length}문제 확정
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

/** 필터 칩 — 유형·선택만 보기 토글. */
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-violet-400 bg-violet-50 text-violet-700"
          : "border-[#ebe9f5] text-slate-500 hover:bg-[#f5f4fb]",
      )}
    >
      {label}
    </button>
  );
}
