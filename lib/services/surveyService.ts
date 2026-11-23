import { getItem, setItem, removeItem } from "@/lib/utils/storage";
import { getDb } from "@/lib/firebase";
import { endOfToday, getGroupCode } from "@/lib/services/groupCodeService";

/**
 * 교육 만족도 조사 — 회차 단위 익명 설문.
 *
 * 설문은 **회차에 딸린 기능**이다. 관리자가 QR을 발급할 때 체크하면 링크에
 * `&s=1`이 붙고, 그 링크로 들어온 기기에서만 홈 화면에 설문 버튼이 뜬다.
 * 플래그는 회차 코드와 짝으로 저장하므로, 코드가 당일 자정에 풀리면 설문도
 * 같이 닫힌다(별도 정리 작업이 없다).
 *
 * 개인정보를 받지 않는 것이 이 서비스의 전제다. 척도 문항은 숫자뿐이고,
 * 주관식은 길이를 제한하고 화면에서 "개인정보를 적지 마세요"를 고정 노출한다.
 * 그래도 들어오는 자유 서술은 막을 수 없으므로, 수집 사실을 개인정보처리방침에
 * 명시해 둔다(`/privacy` 3항).
 *
 * 1인 1표는 익명 구조에서 보장할 수 없다 — 기기의 localStorage 기록으로
 * "같은 기기에서 같은 회차에 두 번"만 막는다. 브라우저 데이터를 지우면 다시
 * 응답할 수 있고, 그건 받아들이는 트레이드오프다.
 */

/** URL 쿼리 파라미터 이름 — 발급 시 체크했을 때만 `1`로 붙는다. */
const QUERY_KEY = "s";

/** 설문 활성 플래그 localStorage 키. */
const FLAG_KEY = "quiz:surveyEnabled";

/** 응답 완료 회차 목록 localStorage 키. */
const DONE_KEY = "quiz:surveyDone";

/** 응답 완료 기록 보관 개수 — 같은 기기로 여러 교육에 와도 충분한 길이. */
const DONE_LIMIT = 20;

/** 주관식 최대 길이. 보안 규칙의 상한과 동일하게 유지할 것. */
export const COMMENT_MAX_LENGTH = 200;

/** 척도 선택지 — 1~5. */
export const RATING_SCALE = [1, 2, 3, 4, 5] as const;

/**
 * 척도 문항. **5가 항상 긍정**이어야 평균을 그대로 만족도로 읽을 수 있다.
 * 그래서 "난이도"처럼 중간이 좋은 문항은 넣지 않았다(평균이 뜻을 잃는다).
 *
 * id는 Firestore 문서의 키이자 보안 규칙의 화이트리스트다 — 바꾸려면
 * `firestore.rules`의 `isValidSurvey`도 같이 고쳐야 한다.
 */
export const SURVEY_QUESTIONS = [
  { id: "overall", label: "전반적으로 만족하셨나요?" },
  { id: "useful", label: "교육 내용이 업무에 도움이 되었나요?" },
  { id: "instructor", label: "강사의 설명이 이해하기 쉬웠나요?" },
] as const;

/** 척도 문항 id. */
export type SurveyRatingId = (typeof SURVEY_QUESTIONS)[number]["id"];

/** 문항 id → 1~5 점수. 세 문항 모두 필수다. */
export type SurveyRatings = Record<SurveyRatingId, number>;

/** 설문 활성 플래그 저장 형태. */
interface SurveyFlagEntry {
  /** 설문이 켜진 회차 코드 */
  code: string;
  /** epoch ms — 이 시각 이후로는 무효 */
  expiresAt: number;
}

/**
 * 진입 URL의 `?s=1`을 읽어 "이 회차는 설문을 받는다"고 저장한다.
 *
 * 같은 URL에 회차 코드(`?g=`)가 함께 있어야만 저장한다. 설문은 회차 단위이므로
 * 코드 없는 `?s=1`은 의미가 없고, 일반 사용자가 주소에 붙여도 아무 일이 없다.
 *
 * @param search `window.location.search` 형태의 문자열
 * @param code 같은 URL에서 캡처한 회차 코드(없으면 null)
 * @returns 설문을 켠 회차 코드, 아니면 null
 */
export function captureSurveyFlagFromSearch(
  search: string,
  code: string | null,
): string | null {
  if (!code) return null;
  try {
    if (new URLSearchParams(search).get(QUERY_KEY) !== "1") return null;
    setItem<SurveyFlagEntry>(FLAG_KEY, { code, expiresAt: endOfToday() });
    notifyChange();
    return code;
  } catch {
    return null;
  }
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

/** 척도 점수가 1~5 정수인지. */
function isValidRating(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;
}

/**
 * 주관식 입력을 저장 가능한 형태로 다듬는다.
 * 제어문자를 지우고 공백을 접은 뒤 상한 길이로 자른다. 비면 빈 문자열.
 */
export function normalizeComment(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, COMMENT_MAX_LENGTH);
}

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
 * 만족도 응답을 `survey_responses`에 1건 기록하고, 이 기기를 응답 완료로 적는다.
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
    if (!isValidRating(ratings[id])) {
      throw new SurveySubmitError("모든 문항에 답해 주세요.");
    }
  }

  const db = getDb();
  if (!db) {
    throw new SurveySubmitError(
      "지금은 응답을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const text = normalizeComment(comment ?? "");

  try {
    const { collection, addDoc, serverTimestamp } = await import(
      "firebase/firestore"
    );
    await addDoc(collection(db, "survey_responses"), {
      g: code,
      ratings: {
        overall: ratings.overall,
        useful: ratings.useful,
        instructor: ratings.instructor,
      },
      createdAt: serverTimestamp(),
      // 빈 주관식은 필드 자체를 넣지 않는다(보안 규칙상 선택 필드).
      ...(text ? { comment: text } : {}),
    });
  } catch {
    throw new SurveySubmitError(
      "응답을 저장하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
    );
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
