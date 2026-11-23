import { getItem, setItem, removeItem } from "@/lib/utils/storage";
import { endOfToday, getGroupCode } from "@/lib/services/groupCodeService";
import { normalizePicks } from "@/lib/utils/questionPicks";

/**
 * 지정 출제 문제 — 회차 단위 "이번 교육 문제"(기기 쪽).
 *
 * **무엇을 출제하는지 정하는 것은 서버다.** 관리자가 발급할 때 문제를 고르면
 * 회차 등록부에 `picks`로 적히고, 기기는 `/api/session`에 물어 그 목록을 받아
 * 온다. 설문(`surveyService`)과 완전히 같은 구조이며, 같은 이유로 **링크에
 * 목록을 싣지 않는다** — 주소에 담으면 교육생이 주소창에서 바꿀 수 있고,
 * 40문제 번호를 QR에 실으면 코드 밀도도 나빠진다.
 *
 * 수명도 설문과 같다 — **당일 자정까지**. 회차 코드가 그때 풀리므로, 플래그만
 * 남아 "이번 교육 문제" 카드가 떠 있으면 어느 교육의 문제인지 알 수 없는
 * 상태가 된다. (교육이 끝난 뒤 집에서 복습하게 두고 싶다면 `expiresAt` 계산만
 * 바꾸면 된다. 설문과 달리 복습은 집계를 오염시키지 않는다 — 회차 코드가 이미
 * 풀려 있어 그 응답은 전체 집계로만 들어간다.)
 */

/** 지정 출제 localStorage 키. */
const STORAGE_KEY = "quiz:assignment";

/** 저장 형태. */
interface AssignmentEntry {
  /** 지정 출제가 있는 회차 코드 */
  code: string;
  /** 문제 id 목록 — 적어 둔 순서가 출제 순서 */
  picks: string[];
  /** epoch ms — 이 시각 이후로는 무효 */
  expiresAt: number;
}

/**
 * 서버가 알려 준 "이 회차의 지정 출제 문제"를 기기에 반영한다.
 *
 * 목록이 비어 있으면 **기록을 지운다.** 지정 출제를 끈 회차로 다시 들어왔는데
 * 예전 목록이 남아 카드가 떠 있으면, 지난 교육의 문제가 이번 교육 문제로
 * 보인다(설문 플래그를 지우는 것과 같은 이유).
 *
 * @returns 지정 출제가 있는 회차 코드, 없으면 null
 */
export function setAssignmentForCode(
  code: string,
  picks: unknown,
): string | null {
  const normalized = normalizePicks(picks);

  if (normalized.length === 0) {
    const entry = getItem<AssignmentEntry | null>(STORAGE_KEY, null);
    if (entry?.code === code) {
      removeItem(STORAGE_KEY);
      notifyChange();
    }
    return null;
  }

  setItem<AssignmentEntry>(STORAGE_KEY, {
    code,
    picks: normalized,
    expiresAt: endOfToday(),
  });
  notifyChange();
  return code;
}

/**
 * 지금 유효한 지정 출제. 없거나 만료됐거나 지금 회차와 다르면 null.
 *
 * 저장된 회차 코드와 **일치**해야 한다. 목록만 남고 회차가 풀린 상태(자정 경과,
 * 다른 회차 QR로 재진입)에서 카드가 떠 있으면, 지난 교육의 문제를 풀게 된다.
 */
export function getAssignment(): { code: string; picks: string[] } | null {
  const entry = getItem<AssignmentEntry | null>(STORAGE_KEY, null);
  if (!entry || typeof entry.code !== "string") return null;

  if (typeof entry.expiresAt !== "number" || Date.now() > entry.expiresAt) {
    removeItem(STORAGE_KEY);
    return null;
  }

  if (getGroupCode() !== entry.code) return null;

  const picks = normalizePicks(entry.picks);
  if (picks.length === 0) return null;

  return { code: entry.code, picks };
}

/**
 * 출제할 문제 id 목록. 지정 출제가 없으면 빈 배열.
 *
 * 풀이 화면이 세션을 시작할 때 **이펙트 안에서 한 번** 읽는다(구독하지 않는다).
 * 하이드레이션 중에 빈 목록을 읽어 "문제가 없습니다"로 굳어 버리는 일을 막기
 * 위해서다 — 세션 시작은 멱등 가드가 걸려 있어 한 번만 일어난다.
 */
export function getAssignmentPicks(): string[] {
  return getAssignment()?.picks ?? [];
}

/** 지정 출제 기록을 지운다(테스트·수동 초기화용). */
export function clearAssignment(): void {
  removeItem(STORAGE_KEY);
  notifyChange();
}

/* ------------------------------------------------------------------ *
 * 지정 출제 상태 구독 (useSyncExternalStore)
 *
 * 홈 화면은 서버에서도 렌더되므로 localStorage를 렌더 중에 읽으면 하이드레이션이
 * 어긋난다. 또 회차 코드 캡처는 마운트 **후** 이펙트에서 일어나므로(QR로 막
 * 들어온 순간), 그때 화면이 다시 그려져야 카드가 나타난다.
 * `surveyService`와 같은 패턴 — 외부 저장소로 취급해 구독한다.
 * ------------------------------------------------------------------ */

/** 홈 화면이 보는 지정 출제 상태. */
export interface AssignmentState {
  /** 지정 출제가 있는 회차 코드. null이면 카드를 그리지 않는다. */
  code: string | null;
  /** 지정된 문제 수. 카드에 "N문제"로 표시한다. */
  count: number;
}

/** SSR 스냅샷 — 매번 같은 참조여야 한다. */
const SERVER_STATE: AssignmentState = Object.freeze({ code: null, count: 0 });

/** 직전 스냅샷. 값이 같으면 같은 참조를 돌려주기 위해 들고 있는다. */
let cachedState: AssignmentState = SERVER_STATE;

const listeners = new Set<() => void>();

/** 상태가 바뀌었음을 구독자에게 알린다. */
function notifyChange(): void {
  for (const listener of listeners) listener();
}

/** 지정 출제 상태 변경을 구독한다. */
export function subscribeAssignmentState(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * 현재 지정 출제 상태 — 값이 그대로면 같은 참조를 돌려준다(무한 렌더 방지).
 * 문제 목록 자체가 아니라 **개수만** 내보내는 이유는, 배열을 내보내면 매
 * 렌더마다 새 참조가 생겨 비교가 깨지기 때문이다. 목록이 필요한 풀이 화면은
 * `getAssignmentPicks()`로 직접 읽는다.
 */
export function getAssignmentStateSnapshot(): AssignmentState {
  const assignment = getAssignment();
  const code = assignment?.code ?? null;
  const count = assignment?.picks.length ?? 0;
  if (cachedState.code !== code || cachedState.count !== count) {
    cachedState = { code, count };
  }
  return cachedState;
}

/** SSR·초기 렌더용 스냅샷. */
export function getAssignmentStateServerSnapshot(): AssignmentState {
  return SERVER_STATE;
}
