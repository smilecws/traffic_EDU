import {
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { issueGroupCode, normalizeBranchSlug } from "@/lib/utils/groupCode";
import { kstDayBoundary, toKstDateString } from "@/lib/utils/kstDate";

/**
 * 교육 회차 등록부(`sessions`) — 서버 전용.
 *
 * 예전에는 회차가 **어디에도 기록되지 않았다.** 관리자 기기의 localStorage에만
 * 남았고, 서버는 쌓인 로그에서 `g` 값을 역산해 "회차가 있었나 보다" 하고
 * 추측했다. 그래서 네 가지가 동시에 깨져 있었다.
 *
 *  1) 기기를 바꾸거나 브라우저 데이터를 지우면 회차가 증발했다.
 *  2) 응답이 0건인 회차는 달력에 아예 뜨지 않았다(교육은 했는데 기록이 없다).
 *  3) 아무 문자열이나 `?g=`로 들어오면 그게 곧 "회차"가 되어 유령 회차가 생겼다.
 *  4) 교육반 이름(한글)이 남지 않아 코드 슬러그만 보고 짐작해야 했다.
 *
 * 이제 발급 시점에 여기 한 줄을 적는다. 등록부가 원본이고, 로그의 `g`는 그
 * 등록부를 가리키는 꼬리표다.
 *
 * 클라이언트는 이 컬렉션을 직접 읽지도 쓰지도 못한다(`firestore.rules`에서
 * 전면 차단). 모든 접근은 서비스 계정을 쓰는 이 모듈을 거친다.
 */

/** 등록부 컬렉션 이름. */
export const SESSIONS_COLLECTION = "sessions";

/** 만족도 응답 컬렉션 이름. */
export const SURVEY_COLLECTION = "survey_responses";

/**
 * 회차 하나가 받을 수 있는 만족도 응답 수 상한.
 *
 * 익명 설문에서 "1인 1표"는 보장할 수 없다 — 기기를 바꾸거나 브라우저 데이터를
 * 지우면 누구든 다시 답할 수 있다. 다만 **대량 투입**은 막을 수 있고, 그게
 * 평균을 실제로 망가뜨리는 유일한 경우다. 한 교육반 정원을 크게 웃도는 값으로
 * 잡아 정상 사용에는 걸리지 않게 한다.
 */
export const SURVEY_RESPONSE_CAP = 200;

/** 코드 충돌 시 다시 뽑는 횟수. 31^3 = 29,791가지라 1회만으로도 충분하다. */
const ISSUE_RETRIES = 5;

/** 등록부에 적히는 회차 1건. */
export interface SessionRecord {
  code: string;
  /** 발급 시 입력한 교육반 원문(한글일 수 있다 — 표시용). */
  branch: string;
  /** 만족도 조사를 함께 받는 회차인지. **이 값만이 설문을 켜고 끈다.** */
  survey: boolean;
  /** epoch ms */
  issuedAt: number;
  /** epoch ms — 발급일 KST 자정. 이후로는 코드도 설문도 닫힌다. */
  expiresAt: number;
  /** 지금까지 들어온 만족도 응답 수. */
  surveyCount: number;
  /** 발급일(KST, `yyyy-MM-dd`) — 달력이 쓴다. */
  date: string;
}

/** Firestore 문서 → SessionRecord. 형태가 깨졌으면 null. */
function toRecord(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): SessionRecord | null {
  if (!data) return null;
  const createdAt = data.createdAt;
  const expiresAt = data.expiresAt;
  // serverTimestamp가 아직 확정되지 않은 문서(쓰기 직후 극히 짧은 구간)는 건너뛴다.
  if (!(createdAt instanceof Timestamp) || !(expiresAt instanceof Timestamp)) {
    return null;
  }
  return {
    code: id,
    branch: typeof data.branch === "string" ? data.branch : "",
    survey: data.survey === true,
    issuedAt: createdAt.toMillis(),
    expiresAt: expiresAt.toMillis(),
    surveyCount: typeof data.surveyCount === "number" ? data.surveyCount : 0,
    date: typeof data.date === "string" ? data.date : toKstDateString(createdAt.toMillis()),
  };
}

/**
 * 새 회차를 발급해 등록부에 적는다.
 *
 * 코드 생성은 `issueGroupCode`가 하고, 여기서는 **이미 쓰인 코드인지 확인**한
 * 뒤 적는다. 랜덤 접미사가 겹칠 확률은 낮지만 0은 아니고, 겹치면 두 교육반의
 * 통계가 한 코드로 합쳐지기 때문이다.
 *
 * @returns 등록된 회차. 교육반 이름을 슬러그로 바꿀 수 없으면 null.
 */
export async function issueSession(
  db: Firestore,
  options: { branch: string; survey: boolean },
  now: Date = new Date(),
): Promise<SessionRecord | null> {
  const branch = options.branch.trim();
  if (!normalizeBranchSlug(branch)) return null;

  const date = toKstDateString(now.getTime());
  const expiresAt = kstDayBoundary(date, "end");

  for (let attempt = 0; attempt < ISSUE_RETRIES; attempt += 1) {
    const code = issueGroupCode(branch, now);
    if (!code) return null;

    const ref = db.collection(SESSIONS_COLLECTION).doc(code);
    try {
      // create()는 이미 있으면 실패한다 — 충돌 확인과 쓰기가 한 번에 끝난다.
      await ref.create({
        branch,
        survey: options.survey === true,
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt),
        surveyCount: 0,
        date,
      });
    } catch {
      continue; // 이미 쓰인 코드 — 접미사를 다시 뽑는다
    }

    return {
      code,
      branch,
      survey: options.survey === true,
      issuedAt: now.getTime(),
      expiresAt: expiresAt.getTime(),
      surveyCount: 0,
      date,
    };
  }

  return null;
}

/** 코드로 회차를 읽는다. 등록되지 않은 코드면 null. */
export async function getSession(
  db: Firestore,
  code: string,
): Promise<SessionRecord | null> {
  const snap = await db.collection(SESSIONS_COLLECTION).doc(code).get();
  if (!snap.exists) return null;
  return toRecord(snap.id, snap.data());
}

/** 최근 발급한 회차를 최신순으로 읽는다. */
export async function listRecentSessions(
  db: Firestore,
  limit: number,
): Promise<SessionRecord[]> {
  const snap = await db
    .collection(SESSIONS_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snap.docs
    .map((doc) => toRecord(doc.id, doc.data()))
    .filter((r): r is SessionRecord => r !== null);
}

/** 기간(epoch ms 경계) 안에 발급된 회차를 모두 읽는다 — 달력이 쓴다. */
export async function listSessionsInRange(
  db: Firestore,
  start: Date,
  end: Date,
): Promise<SessionRecord[]> {
  const snap = await db
    .collection(SESSIONS_COLLECTION)
    .where("createdAt", ">=", Timestamp.fromDate(start))
    .where("createdAt", "<=", Timestamp.fromDate(end))
    .get();

  return snap.docs
    .map((doc) => toRecord(doc.id, doc.data()))
    .filter((r): r is SessionRecord => r !== null);
}

/** 만족도 응답이 거부된 이유. 화면 문구는 호출부가 고른다. */
export type SurveyRejection = "unknown" | "closed" | "expired" | "full";

/** 만족도 응답 1건의 내용(검증은 호출부에서 끝낸 상태로 들어온다). */
export interface SurveyPayload {
  ratings: { overall: number; useful: number; instructor: number };
  /** 빈 문자열이면 필드를 넣지 않는다. */
  comment: string;
}

/**
 * 만족도 응답을 기록한다 — **등록부를 근거로 검증한 뒤에만**.
 *
 * 예전에는 브라우저가 Firestore에 직접 썼고, 보안 규칙은 "코드 형식이 맞는가"만
 * 봤다. 그래서 링크에 `&s=1`만 붙이면 설문을 켜지 않은 회차에도 응답이 들어갔고,
 * 존재하지 않는 코드로도 쌓을 수 있었다. 이제 네 가지를 서버가 확인한다.
 *
 *  - 실제로 발급된 회차인가
 *  - 그 회차가 설문을 받기로 한 회차인가 (URL이 아니라 등록부가 정한다)
 *  - 아직 교육 당일인가 (기기 시계가 아니라 서버 시각으로 판단한다)
 *  - 응답 수가 상한을 넘지 않았는가
 *
 * 카운트 증가와 응답 저장을 한 트랜잭션에 묶어, 동시에 들어온 응답이 상한을
 * 함께 넘어서지 않게 한다.
 */
export async function recordSurveyResponse(
  db: Firestore,
  code: string,
  payload: SurveyPayload,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; reason: SurveyRejection }> {
  const sessionRef = db.collection(SESSIONS_COLLECTION).doc(code);
  const responseRef = db.collection(SURVEY_COLLECTION).doc();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) return { ok: false as const, reason: "unknown" as const };

    const record = toRecord(snap.id, snap.data());
    if (!record) return { ok: false as const, reason: "unknown" as const };
    if (!record.survey) return { ok: false as const, reason: "closed" as const };
    if (now.getTime() > record.expiresAt) {
      return { ok: false as const, reason: "expired" as const };
    }
    if (record.surveyCount >= SURVEY_RESPONSE_CAP) {
      return { ok: false as const, reason: "full" as const };
    }

    tx.create(responseRef, {
      g: code,
      ratings: payload.ratings,
      createdAt: FieldValue.serverTimestamp(),
      ...(payload.comment ? { comment: payload.comment } : {}),
    });
    tx.update(sessionRef, { surveyCount: FieldValue.increment(1) });

    return { ok: true as const };
  });
}
