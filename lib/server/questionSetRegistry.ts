import {
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { MAX_PICKS, normalizePicks } from "@/lib/utils/questionPicks";

/**
 * 출제 세트 보관함(`question_sets`) — 서버 전용.
 *
 * 교수자가 1000문제에서 고른 묶음에 이름을 붙여 두는 곳이다. 한 번 고르는
 * 일이 가장 번거롭기 때문에, 다음 교육에서는 **목록에서 고르기만** 하면 되도록
 * 서버에 남긴다. 관리자 기기의 localStorage에 두지 않는 이유는 회차 등록부와
 * 같다 — 기기를 바꾸거나 브라우저 데이터를 지우면 통째로 사라진다.
 *
 * 세트는 **발급과 무관한 보관함**이다. 회차에는 세트 id가 아니라 문제 목록이
 * 값으로 복사돼 들어간다(`sessionRegistry`의 `picks`). 그래서 세트를 고치거나
 * 지워도 이미 발급된 회차의 출제 내용은 변하지 않는다.
 *
 * 클라이언트는 이 컬렉션을 직접 읽지도 쓰지도 못한다(`firestore.rules` 전면 차단).
 * 모든 접근은 서비스 계정을 쓰는 이 모듈을 거친다.
 */

/** 보관함 컬렉션 이름. */
export const QUESTION_SETS_COLLECTION = "question_sets";

/** 세트 이름 최대 길이 — 목록에서 한 줄에 들어오는 선. */
export const SET_NAME_MAX_LENGTH = 40;

/** 보관할 수 있는 세트 수 상한. 넘으면 오래된 것부터 지우게 안내한다. */
export const MAX_SETS = 50;

/** 보관함에 적히는 세트 1건. */
export interface QuestionSetRecord {
  id: string;
  /** 교수자가 붙인 이름. 비어 있을 수 없다(목록에서 이것만 보고 고른다). */
  name: string;
  /** 문제 id 목록 — 적어 둔 순서가 출제 순서다. */
  picks: string[];
  /** epoch ms */
  createdAt: number;
}

/**
 * 세트 이름을 저장 가능한 형태로 다듬는다. 알아볼 수 없으면 빈 문자열.
 *
 * 회차의 교육반 이름(`normalizeBranchName`)과 달리 **비어 있으면 안 된다.**
 * 회차는 코드로 식별되지만 세트는 이름으로만 고르기 때문이다.
 */
export function normalizeSetName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SET_NAME_MAX_LENGTH);
}

/** Firestore 문서 → QuestionSetRecord. 형태가 깨졌으면 null. */
function toRecord(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): QuestionSetRecord | null {
  if (!data) return null;
  const createdAt = data.createdAt;
  // serverTimestamp가 아직 확정되지 않은 문서는 건너뛴다(쓰기 직후 극히 짧은 구간).
  if (!(createdAt instanceof Timestamp)) return null;

  const name = typeof data.name === "string" ? normalizeSetName(data.name) : "";
  const picks = normalizePicks(data.picks);
  // 이름이나 문제가 없는 세트는 고를 수도 쓸 수도 없다 — 목록에서 숨긴다.
  if (!name || picks.length === 0) return null;

  return { id, name, picks, createdAt: createdAt.toMillis() };
}

/** 세트 저장이 거부된 이유. 화면 문구는 호출부가 고른다. */
export type SetRejection = "name" | "picks" | "full";

/**
 * 새 세트를 보관함에 적는다.
 *
 * 같은 이름을 막지 않는다 — "음주반 핵심 20"을 해마다 다시 만들 수 있고,
 * 어느 쪽을 쓸지는 교수자가 목록에서 보고 고르면 된다. 대신 개수 상한을 둬서
 * 목록이 무한히 길어지지 않게 한다.
 */
export async function createQuestionSet(
  db: Firestore,
  options: { name: string; picks: unknown },
): Promise<
  { ok: true; set: QuestionSetRecord } | { ok: false; reason: SetRejection }
> {
  const name = normalizeSetName(options.name ?? "");
  if (!name) return { ok: false, reason: "name" };

  const picks = normalizePicks(options.picks);
  if (picks.length === 0) return { ok: false, reason: "picks" };

  // 상한 확인 — 세트는 수십 건 규모라 개수를 세는 비용이 무시할 만하다.
  const existing = await db
    .collection(QUESTION_SETS_COLLECTION)
    .count()
    .get();
  if (existing.data().count >= MAX_SETS) return { ok: false, reason: "full" };

  const ref = db.collection(QUESTION_SETS_COLLECTION).doc();
  const now = Date.now();
  await ref.create({
    name,
    picks,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, set: { id: ref.id, name, picks, createdAt: now } };
}

/** 보관된 세트를 최신순으로 읽는다. */
export async function listQuestionSets(
  db: Firestore,
  limit: number = MAX_SETS,
): Promise<QuestionSetRecord[]> {
  const snap = await db
    .collection(QUESTION_SETS_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(Math.min(limit, MAX_SETS))
    .get();

  return snap.docs
    .map((doc) => toRecord(doc.id, doc.data()))
    .filter((r): r is QuestionSetRecord => r !== null);
}

/**
 * 세트를 지운다. 없는 id여도 조용히 성공한다(지워진 상태가 목표이므로).
 *
 * 이미 발급된 회차는 영향을 받지 않는다 — 회차는 문제 목록을 값으로 갖고 있다.
 */
export async function deleteQuestionSet(
  db: Firestore,
  id: string,
): Promise<void> {
  await db.collection(QUESTION_SETS_COLLECTION).doc(id).delete();
}

/** 세트 1건이 담을 수 있는 문제 수 상한 — 회차의 지정 출제 상한과 같다. */
export { MAX_PICKS };
