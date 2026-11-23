import { getItem, setItem, removeItem } from "@/lib/utils/storage";
import { endOfToday, getGroupCode } from "@/lib/services/groupCodeService";
import {
  SURVEY_QUESTIONS,
  normalizeComment,
  type SurveyRatings,
} from "@/lib/utils/survey";

/**
 * 교육 만족도 조사 — 회차 단위 익명 설문(기기 쪽).
 *
 * **설문을 켜고 끄는 것은 서버다.** 관리자가 발급할 때 체크하면 회차 등록부에
 * `survey: true`로 적히고, 기기는 `/api/session`에 물어 그 값을 받아 온다.
 * 예전에는 링크의 `&s=1`이 그 역할을 했는데, 교육생이 주소창에 직접 붙여도
 * 설문이 열려서 "설문을 받지 않기로 한 회차"에 응답이 쌓일 수 있었다.
 *
 * 개인정보를 받지 않는 것이 이 서비스의 전제다. 척도 문항은 숫자뿐이고,
 * 주관식은 길이를 제한하고 화면에서 "개인정보를 적지 마세요"를 고정 노출한다.
 * 그래도 들어오는 자유 서술은 막을 수 없으므로, 수집 사실을 개인정보처리방침에
 * 명시해 둔다(`/privacy` 3항).
 *
 * 1인 1표는 익명 구조에서 보장할 수 없다 — 기기의 localStorage 기록으로
 * "같은 기기에서 같은 회차에 두 번"만 막는다. 브라우저 데이터를 지우면 다시
 * 응답할 수 있고, 그건 받아들이는 트레이드오프다. 다만 **대량 투입**은 서버가
 * 회차당 상한으로 막는다(`SURVEY_RESPONSE_CAP`).
 */

export {
  COMMENT_MAX_LENGTH,
  RATING_SCALE,
  SURVEY_QUESTIONS,
  normalizeComment,
  type SurveyRatingId,
  type SurveyRatings,
} from "@/lib/utils/survey";

/** 설문 활성 플래그 localStorage 키. */
const FLAG_KEY = "quiz:surveyEnabled";

/** 응답 완료 회차 목록 localStorage 키. */
const DONE_KEY = "quiz:surveyDone";

/** 응답 완료 기록 보관 개수 — 같은 기기로 여러 교육에 와도 충분한 길이. */
const DONE_LIMIT = 20;

/** 설문 활성 플래그 저장 형태. */
interface SurveyFlagEntry {
  /** 설문이 켜진 회차 코드 */
  code: string;
  /** epoch ms — 이 시각 이후로는 무효 */
  expiresAt: number;
}

/**
 * 서버가 알려 준 "이 회차가 설문을 받는지"를 기기에 반영한다.
 *
 * `survey`가 false면 **플래그를 지운다.** 설문을 끈 회차로 다시 들어왔는데
 * 예전 플래그가 남아 버튼이 떠 있으면, 눌러 봐야 서버가 거부할 뿐이다.
 *
 * @returns 설문을 켠 회차 코드, 켜지 않았으면 null
 */
export function setSurveyForCode(code: string, survey: boolean): string | null {
  if (!survey) {
    const entry = getItem<SurveyFlagEntry | null>(FLAG_KEY, null);
    if (entry?.code === code) {
      removeItem(FLAG_KEY);
      notifyChange();
    }
    return null;
  }

  setItem<SurveyFlagEntry>(FLAG_KEY, { code, expiresAt: endOfToday() });
  notifyChange();
  return code;
}

/**
 * 설문을 받을 회차 코드. 없거나 만료됐거나 지금 회차와 다르면 null.
 *
 * 저장된 회차 코드와 **일치**해야 한다. 플래그만 남고 회차가 풀린 상태(자정 경과,
 * 다른 회차 QR로 재진입)에서 설문이 떠 있으면, 응답이 엉뚱한 회차로 붙는다.
 */
export function getSurveyCode(): string | null {
  const entry = getItem<SurveyFlagEntry | null>(FLAG_KEY, null);
  if (!entry || typeof entry.code !== "string") return null;

  if (typeof entry.expiresAt !== "number" || Date.now() > entry.expiresAt) {
    removeItem(FLAG_KEY);
    return null;
  }

  return getGroupCode() === entry.code ? entry.code : null;
}

/** 응답 완료 회차 목록. */
function getDoneCodes(): string[] {
  const list = getItem<string[]>(DONE_KEY, []);
  return Array.isArray(list) ? list.filter((c) => typeof c === "string") : [];
}

/** 이 기기가 그 회차의 설문에 이미 응답했는지. */
export function isSurveyDone(code: string): boolean {
  return getDoneCodes().includes(code);
}

/** 응답 완료로 기록한다(회차별 — 다음 교육에서는 다시 응답할 수 있다). */
export function markSurveyDone(code: string): void {
  if (isSurveyDone(code)) return;
  setItem(DONE_KEY, [code, ...getDoneCodes()].slice(0, DONE_LIMIT));
  notifyChange();
}

/** 설문 플래그와 응답 기록을 지운다(테스트·수동 초기화용). */
export function clearSurveyState(): void {
  removeItem(FLAG_KEY);
  removeItem(DONE_KEY);
  notifyChange();
}

/* ------------------------------------------------------------------ *
 * 제출
 * ------------------------------------------------------------------ */

/** 제출 실패 — 화면이 사용자에게 알려야 하는 에러. */
export class SurveySubmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SurveySubmitError";
  }
}

export interface SubmitSurveyOptions {
  /** 설문을 받는 회차 코드 */
  code: string;
  ratings: SurveyRatings;
  /** 주관식(선택) */
  comment?: string;
}

/**
 * 만족도 응답을 서버 라우트에 제출하고, 이 기기를 응답 완료로 적는다.
 *
 * Firestore에 직접 쓰지 않는다 — 발급된 회차인지, 설문을 받는 회차인지,
 * 아직 교육 당일인지, 상한을 넘지 않았는지는 **서버만 판단할 수 있다**.
 *
 * 오답 로그(`logAnswers`)와 달리 **실패를 삼키지 않는다**. 사용자가 제출 버튼을
 * 누른 행위라서, 저장되지 않았는데 "감사합니다"를 띄우면 거짓말이 된다.
 * 호출부가 에러를 받아 화면에 표시한다.
 */
export async function submitSurvey({
  code,
  ratings,
  comment,
}: SubmitSurveyOptions): Promise<void> {
  for (const { id } of SURVEY_QUESTIONS) {
    const value = ratings[id];
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new SurveySubmitError("모든 문항에 답해 주세요.");
    }
  }

  let res: Response;
  try {
    res = await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        code,
        ratings,
        comment: normalizeComment(comment ?? ""),
      }),
    });
  } catch {
    throw new SurveySubmitError(
      "응답을 저장하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
    );
  }

  if (!res.ok) {
    let message = "응답을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // JSON이 아닌 응답 — 기본 문구로
    }
    throw new SurveySubmitError(message);
  }

  markSurveyDone(code);
}

/* ------------------------------------------------------------------ *
 * 설문 상태 구독 (useSyncExternalStore)
 *
 * 홈 화면은 서버에서도 렌더되므로 localStorage를 렌더 중에 읽으면 하이드레이션이
 * 어긋난다. 또 회차 코드 캡처는 마운트 **후** 이펙트에서 일어나므로(QR로 막
 * 들어온 순간), 그때 화면이 다시 그려져야 설문 버튼이 나타난다.
 * 외부 저장소로 취급해 구독한다.
 * ------------------------------------------------------------------ */

/** 홈 화면이 보는 설문 상태. */
export interface SurveyState {
  /** 설문을 받는 회차 코드. null이면 설문 없음(버튼을 그리지 않는다). */
  code: string | null;
  /** 그 회차에 이 기기가 이미 응답했는지. */
  done: boolean;
}

/** SSR 스냅샷 — 매번 같은 참조여야 한다. */
const SERVER_STATE: SurveyState = Object.freeze({ code: null, done: false });

/** 직전 스냅샷. 값이 같으면 같은 참조를 돌려주기 위해 들고 있는다. */
let cachedState: SurveyState = SERVER_STATE;

const listeners = new Set<() => void>();

/** 상태가 바뀌었음을 구독자에게 알린다. */
function notifyChange(): void {
  for (const listener of listeners) listener();
}

/** 설문 상태 변경을 구독한다. */
export function subscribeSurveyState(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * 현재 설문 상태 — 값이 그대로면 같은 참조를 돌려준다(무한 렌더 방지).
 * 매 렌더마다 localStorage를 읽지만 키 두 개뿐이라 비용이 무시할 만하고,
 * 그 덕에 자정 경과 같은 "알림 없는 변화"도 다음 렌더에 반영된다.
 */
export function getSurveyStateSnapshot(): SurveyState {
  const code = getSurveyCode();
  const done = code ? isSurveyDone(code) : false;
  if (cachedState.code !== code || cachedState.done !== done) {
    cachedState = { code, done };
  }
  return cachedState;
}

/** SSR·초기 렌더용 스냅샷. */
export function getSurveyStateServerSnapshot(): SurveyState {
  return SERVER_STATE;
}
