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
import { useWrongNotes } from "@/lib/hooks/useWrongNotes";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { useBackGuard } from "@/lib/hooks/useBackGuard";
import { useUnloadWarning } from "@/lib/hooks/useUnloadWarning";
import { isAnswerCorrect } from "@/lib/utils/calculateScore";
import { useAppStore } from "@/lib/store/appStore";
import { saveSessionResult } from "@/lib/services/sessionResultService";
import { getAssignmentPicks } from "@/lib/services/assignmentService";
import { beaconAnswers, logAnswers } from "@/lib/services/answerLogService";
import { markSolved } from "@/lib/services/solvedService";
import { getLicense, MOCK_DURATION_MS } from "@/lib/data/licenses";
import type { QuestionResult, QuizMode, SessionMeta } from "@/lib/types";
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
    v === "sequential" ||
    v === "assigned"
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
  const { addWrongNote } = useWrongNotes();
  const setQuizInProgress = useAppStore((s) => s.setQuizInProgress);

  /** 현재 문제에서 고른 선택지 목록 (복수 선택). */
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  /** 현재 문제를 제출(채점)했는지 — 제출 후 피드백 표시. */
  const [submitted, setSubmitted] = useState(false);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  /**
   * 중간 이탈 시 익명 집계(`answer_logs`).
   *
   * 예전에는 결과 화면에 도착해야만 집계됐다. 그래서 교육생이 도중에 나가면
   * 그때까지 답한 문제도 회차 통계에서 통째로 빠졌다. 이제 나가는 순간 답한
   * 문제를 보낸다. 이미 보낸 문제 id를 기억해 두어, 페이지가 bfcache로
   * 되살아나 이어서 끝내더라도 같은 문제가 두 번 집계되지 않게 한다.
   *
   * 이탈 핸들러(popstate·pagehide)는 렌더와 무관한 시점에 불리므로 최신
   * 세션을 ref로 들고 간다.
   */
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const loggedIdsRef = useRef<Set<string>>(new Set());

  /** 아직 집계로 보내지 않은, 실제로 답한 문제를 꺼내고 "보냄"으로 표시한다. */
  const takeUnlogged = useCallback((): QuestionResult[] => {
    const results = sessionRef.current?.results ?? [];
    const pending = results.filter(
      (r) => r.selectedIds.length > 0 && !loggedIdsRef.current.has(r.questionId),
    );
    for (const r of pending) loggedIdsRef.current.add(r.questionId);
    return pending;
  }, []);

  // 새로고침·탭 닫기·다른 사이트로 이동. 일반 Firestore 쓰기는 페이지와 함께
  // 끊기므로 비콘으로 보낸다. 채점이 끝난 뒤(결과 화면 이동)에는 결과 화면이 맡는다.
  useEffect(() => {
    const handlePageHide = () => {
      if (finishedRef.current) return;
      beaconAnswers(takeUnlogged());
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [takeUnlogged]);

  // 앱 안에서 풀이 화면을 벗어남 — ← 버튼, 브라우저 뒤로가기, 상단·하단 메뉴 등
  // 경로와 상관없이 화면이 닫힐 때 한 번 보낸다. 페이지는 살아 있으므로 일반
  // 쓰기로 충분하다. 채점이 끝나 결과 화면으로 가는 경우는 결과 화면이 맡는다.
  useEffect(() => {
    return () => {
      if (finishedRef.current) return;
      void logAnswers(takeUnlogged());
    };
  }, [takeUnlogged]);

  // 풀이 중 나가기. 모의고사는 응시가 무효화되므로 확인 후 나간다.
  // router.back()은 방문 기록에 의존해 기록이 얕으면(모바일 딥링크/새 탭/PWA)
  // 사이트 밖으로 나가버린다. 기록과 무관하게 항상 문제 풀기 허브로 가도록 replace 사용.
  // useBackGuard가 브라우저 뒤로가기도 이 동작으로 맞춰 준다(앱 ← 버튼과 동일).
  const { requestLeave, leaveWith } = useBackGuard({
    confirmLeave: () =>
      !isMock ||
      finishedRef.current ||
      window.confirm(
        "모의고사를 종료하고 나갈까요?\n채점 결과와 응시 이력은 남지 않습니다.",
      ),
    onLeave: () => {
      setQuizInProgress(false);
      router.replace("/quiz");
    },
  });

  // 새로고침·탭 닫기 경고. 응시가 무효화되는 모의고사에만 걸어 ← 버튼/뒤로가기의
  // 확인 기준과 맞춘다. 채점이 끝나면(결과 화면으로 이동) 더 경고하지 않는다.
  useUnloadWarning(isMock && !isComplete);

  // 진입 시 1회 세션 시작 (mode/license 전달).
  //
  // 지정 출제(assigned)는 문제 목록을 **여기서** 읽는다. 주소에 싣지 않는 이유는
  // 교육생이 주소창에서 바꿀 수 있고 링크가 길어지기 때문이고, 구독하지 않고
  // 이펙트 안에서 한 번 읽는 이유는 하이드레이션 중의 빈 목록이 "문제가 없습니다"로
  // 굳어 버리지 않게 하기 위해서다(세션 시작은 startedRef로 한 번만 일어난다).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setQuizInProgress(true);
    const ids =
      questionIds ?? (mode === "assigned" ? getAssignmentPicks() : undefined);
    void startSession({ mode, license, type, startNumber, questionIds: ids });
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
      // 도중에 이미 집계로 보낸 문제가 있으면 결과 화면이 빼고 보내도록 알린다.
      if (loggedIdsRef.current.size > 0) {
        meta.loggedQuestionIds = [...loggedIdsRef.current];
      }
      // finish()가 반환한 results(미응답 채움 포함)를 저장 → 오답노트/집계 누락 방지.
      saveSessionResult({ result, results, meta });
      // replace로 진입 — 끝난 퀴즈는 히스토리에 남기지 않아, 결과에서 뒤로가기 시
      // 풀이 화면으로 되돌아가지 않고 그 이전(허브/오답노트 등)으로 간다.
      // leaveWith로 감싸 가드 항목까지 걷어낸다(남겨 두면 결과→뒤로가기가 풀이 화면으로 감).
      leaveWith(() => router.replace(`/result/${result.id}`));
    }
  }, [isMock, finish, setQuizInProgress, license, mode, router, leaveWith]);

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
              : mode === "assigned"
                ? "지정된 문제를 찾을 수 없습니다"
                : "풀 수 있는 문제가 없습니다"}
        </p>
        <p className="text-sm text-slate-500">
          {mode === "assigned"
            ? "교육 회차가 끝났거나(당일 자정) 지정이 해제되었습니다. 교육장 QR을 다시 찍어 주세요."
            : "문제를 풀면 여기에 모입니다."}
        </p>
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

  // 한 문제 채점 결과를 개인 통계 + 오답노트에 즉시 반영(문제당).
  // 세션 완료를 기다리지 않으므로 중간에 나가도 푼 문제는 통계/오답노트에 남는다.
  const persistAnswer = (selected: number[]) => {
    const correct = isAnswerCorrect(selected, currentQuestion.answerIds);
    recordAnswer(correct);
    // 문제별 "푼 적 있음" — 랜덤 출제가 안 푼 문제를 먼저 고르는 데 쓴다.
    markSolved(currentQuestion.id);
    if (!correct) {
      addWrongNote({
        questionId: currentQuestion.id,
        selectedIds: selected,
        addedAt: Date.now(),
      });
    }
  };

  // 제출 → 채점(hook이 담당) 후 피드백 표시. 통계·오답노트는 문제당 즉시 반영.
  const handleSubmit = () => {
    if (selectedIds.length === 0) return;
    answer(currentQuestion.id, selectedIds);
    persistAnswer(selectedIds);
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
  // 답한 문제만 통계·오답노트에 반영(미응답은 제외).
  const handleMockNext = () => {
    if (selectedIds.length > 0) {
      answer(currentQuestion.id, selectedIds);
      persistAnswer(selectedIds);
    }
    next();
    setSelectedIds([]);
  };

  // 앱 ← 버튼. 확인·이동은 useBackGuard가 브라우저 뒤로가기와 공유한다.
  const handleExit = requestLeave;

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
