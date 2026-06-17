"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useQuizSession } from "@/lib/hooks/useQuizSession";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useStats } from "@/lib/hooks/useStats";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { isAnswerCorrect } from "@/lib/utils/calculateScore";
import { useAppStore } from "@/lib/store/appStore";
import { saveSessionResult } from "@/lib/services/sessionResultService";
import { getLicense, MOCK_DURATION_MS } from "@/lib/data/licenses";
import type { QuizMode, SessionMeta } from "@/lib/types";
import { QuizCard } from "@/components/quiz/QuizCard";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import { Button } from "@/components/shared/Button";
import { Spinner } from "@/components/shared/Spinner";
import { cn } from "@/lib/utils/cn";

function isQuizMode(v: string | null): v is QuizMode {
  return (
    v === "random" ||
    v === "wrong" ||
    v === "favorite" ||
    v === "mock" ||
    v === "sequential"
  );
}

/** 남은 ms를 mm:ss로 변환. */
function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function QuizPlayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: QuizMode = isQuizMode(modeParam) ? modeParam : "random";
  const license = searchParams.get("license") ?? undefined;
  // 유형 필터 — '문제 풀기'에서 선택한 유형. 없으면 전체 대상.
  const type = searchParams.get("type") ?? undefined;
  // 순서대로 풀기 — 시작 문제 번호. sequential 모드에서만 사용.
  const startParam = searchParams.get("start");
  const startNumber = startParam ? Number(startParam) : undefined;
  // 특정 문제만 풀기 — 오답노트에서 "해당 문제만 다시 풀기" 등. 모드보다 우선.
  // 매 렌더 새 배열이 effect를 재실행시키지 않도록 idsParam 기준으로 메모이즈.
  const idsParam = searchParams.get("ids");
  const questionIds = useMemo(
    () => (idsParam ? idsParam.split(",").filter(Boolean) : undefined),
    [idsParam],
  );
  const isMock = mode === "mock";

  const {
    session,
    currentQuestion,
    currentIndex,
    total,
    isComplete,
    loading,
    startSession,
    answer,
    next,
    finish,
  } = useQuizSession();
  const { data: favorites, toggleFavorite } = useFavorites();
  const { recordAnswer } = useStats();
  const setQuizInProgress = useAppStore((s) => s.setQuizInProgress);

  /** 현재 문제에서 고른 선택지 목록 (복수 선택). */
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  /** 현재 문제를 제출(채점)했는지 — 제출 후 피드백 표시. */
  const [submitted, setSubmitted] = useState(false);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  // 진입 시 1회 세션 시작 (mode/license 전달).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setQuizInProgress(true);
    void startSession({ mode, license, type, startNumber, questionIds });
    return () => setQuizInProgress(false);
  }, [
    startSession,
    setQuizInProgress,
    mode,
    license,
    type,
    startNumber,
    questionIds,
  ]);

  // 채점 후 결과 페이지로 이동 (정상 완료/시간 초과 공용, 멱등 가드).
  // mock은 미응답을 오답으로 채워 분모=전체 문제 수가 되게 한다.
  // 통계/오답노트/익명 집계는 결과 페이지에서 1회 처리하므로 여기서 중복 처리 금지.
  const completeSession = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const finished = isMock ? finish({ fillUnansweredAsWrong: true }) : finish();
    setQuizInProgress(false);
    if (finished) {
      const { result, results } = finished;
      const meta: SessionMeta = isMock
        ? {
            mode: "mock",
            licenseId: license,
            passScore: license ? getLicense(license)?.passScore : undefined,
            durationMs: MOCK_DURATION_MS,
          }
        : { mode };
      // finish()가 반환한 results(미응답 채움 포함)를 저장 → 오답노트/집계 누락 방지.
      saveSessionResult({ result, results, meta });
      // replace로 진입 — 끝난 퀴즈는 히스토리에 남기지 않아, 결과에서 뒤로가기 시
      // 풀이 화면으로 되돌아가지 않고 그 이전(허브/오답노트 등)으로 간다.
      router.replace(`/result/${result.id}`);
    }
  }, [isMock, finish, setQuizInProgress, license, mode, router]);

  // 마지막 문제까지 답하면 채점/이동.
  useEffect(() => {
    if (!isComplete) return;
    completeSession();
  }, [isComplete, completeSession]);

  // 모의고사 카운트다운 — mock이고 문제가 로드된 동안만 동작.
  const { remainingMs } = useCountdown(MOCK_DURATION_MS, {
    active: isMock && total > 0,
    onExpire: completeSession,
  });

  // 다음 문제 이미지 미리 받기(preload) — 사용자가 현재 문제를 푸는 동안
  // 바로 다음 1문제의 이미지를 백그라운드로 받아 캐시에 넣어, 전환 시 즉시 표시되게 한다.
  // 전송량을 줄이는 게 아니라 받는 시점을 앞당기는 것. 영상은 용량이 커서 제외.
  useEffect(() => {
    const nextQuestion = session?.questions[currentIndex + 1];
    if (!nextQuestion?.images) return;
    for (const src of nextQuestion.images) {
      const img = new window.Image();
      img.src = src;
    }
  }, [session, currentIndex]);

  // 세션 로딩 중
  if (loading || !session) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-32">
        <Spinner label="문제를 불러오는 중" />
      </main>
    );
  }

  // 빈 소스(오답/즐겨찾기 없음) — 채점/이동 시도하지 않고 안내만.
  if (total === 0) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-32 text-center">
        <p className="text-base font-semibold text-slate-900">
          {mode === "wrong"
            ? "오답노트가 비어 있습니다"
            : mode === "favorite"
              ? "즐겨찾기한 문제가 없습니다"
              : "풀 수 있는 문제가 없습니다"}
        </p>
        <p className="text-sm text-slate-500">문제를 풀면 여기에 모입니다.</p>
        <Button onClick={() => router.push("/quiz")}>
          문제 풀기로 돌아가기
        </Button>
      </main>
    );
  }

  // 마지막 문제까지 끝남 → 채점/이동 대기
  if (isComplete || !currentQuestion) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-32">
        <Spinner label="채점 중" />
      </main>
    );
  }

  const isFavorite =
    favorites?.some((f) => f.questionId === currentQuestion.id) ?? false;
  const isLast = currentIndex === total - 1;
  const lowTime = remainingMs <= 60_000;

  // 제출 전: 선택지 토글. 제출 후에는 변경 불가.
  const handleToggle = (id: number) => {
    if (submitted) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // 제출 → 채점(hook이 담당) 후 피드백 표시. 개인 통계는 문제당 즉시 누적.
  const handleSubmit = () => {
    if (selectedIds.length === 0) return;
    answer(currentQuestion.id, selectedIds);
    recordAnswer(isAnswerCorrect(selectedIds, currentQuestion.answerIds));
    setSubmitted(true);
  };

  // 다음 문제로 진행 + 로컬 상태 초기화.
  const handleNext = () => {
    next();
    setSelectedIds([]);
    setSubmitted(false);
  };

  // 모의고사: 즉시 채점/피드백 없이 답만 기록하고 다음으로(실전 방식).
  // 채점·해설은 마지막에 결과 화면에서 한 번에 본다. 미선택이면 그냥 건너뜀(미응답).
  // 답한 문제만 개인 통계에 누적(미응답은 집계 제외).
  const handleMockNext = () => {
    if (selectedIds.length > 0) {
      answer(currentQuestion.id, selectedIds);
      recordAnswer(isAnswerCorrect(selectedIds, currentQuestion.answerIds));
    }
    next();
    setSelectedIds([]);
  };

  // 풀이 중 나가기. 모의고사는 응시가 무효화되므로 확인 후 나간다.
  // router.back()은 방문 기록에 의존해 기록이 얕으면(모바일 딥링크/새 탭/PWA)
  // 사이트 밖으로 나가버린다. 기록과 무관하게 항상 문제 풀기 허브로 가도록 replace 사용.
  // (push 대신 replace → 현재 항목을 교체하므로 뒤로가기로 퀴즈에 되돌아오는 루프도 없음)
  const handleExit = () => {
    if (isMock) {
      const ok = window.confirm(
        "모의고사를 종료하고 나갈까요?\n지금까지 응시한 내용은 저장되지 않습니다.",
      );
      if (!ok) return;
    }
    setQuizInProgress(false);
    router.replace("/quiz");
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleExit}
          aria-label="나가기"
          className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-[#f5f4fb]"
        >
          <ArrowLeft size={24} strokeWidth={1.5} />
        </button>
        {isMock && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">모의고사</span>
            <span
              className={cn(
                "font-mono text-lg font-semibold tabular-nums",
                lowTime ? "text-red-500" : "text-slate-900",
              )}
            >
              {formatMmSs(remainingMs)}
            </span>
          </div>
        )}
      </div>

      <QuizProgress current={currentIndex + 1} total={total} />

      <QuizCard
        question={currentQuestion}
        selectedIds={selectedIds}
        submitted={submitted}
        onToggle={handleToggle}
        isFavorite={isFavorite}
        onToggleFavorite={() => toggleFavorite(currentQuestion.id)}
      />

      <div className="flex justify-end gap-3">
        {isMock ? (
          // 모의고사: 제출/피드백 없이 답만 기록하고 진행. 채점은 결과 화면에서.
          <Button onClick={handleMockNext}>
            {isLast ? "제출하고 결과 보기" : "다음 문제"}
          </Button>
        ) : submitted ? (
          <Button onClick={handleNext}>
            {isLast ? "결과 보기" : "다음 문제"}
          </Button>
        ) : (
          <>
            {/* 순서대로 풀기: 제출(채점) 없이도 넘어갈 수 있게 건너뛰기 제공. */}
            {mode === "sequential" && (
              <Button variant="secondary" onClick={handleNext}>
                {isLast ? "결과 보기" : "건너뛰기"}
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={selectedIds.length === 0}>
              제출
            </Button>
          </>
        )}
      </div>
    </main>
  );
}

export default function QuizPage() {
  // useSearchParams는 Suspense 경계가 필요하다(없으면 프로덕션 빌드 실패).
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center px-4 py-32">
          <Spinner label="불러오는 중" />
        </main>
      }
    >
      <QuizPlayInner />
    </Suspense>
  );
}
