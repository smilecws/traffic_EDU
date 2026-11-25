import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { ANSWER_LOGS_COLLECTION } from "@/lib/server/sessionRegistry";
import { normalizeGroupCode } from "@/lib/utils/groupCode";

/**
 * 공개 — 풀이 도중 페이지가 닫힐 때 보내는 답안 로그(`navigator.sendBeacon`).
 *
 * 평소의 답안 로그는 브라우저가 Firestore에 직접 쓴다(`logAnswers`). 하지만
 * 새로고침·탭 닫기 순간에는 그 쓰기가 끝나기 전에 페이지가 사라진다. 비콘은
 * 페이지가 닫혀도 전송이 보장되므로, 여기서 받아 서비스 계정으로 대신 적는다.
 *
 * 받아들이는 형태는 `firestore.rules`의 `isValidAnswerLog`와 똑같이 제한한다 —
 * 이 라우트가 규칙을 우회하는 뒷문이 되면 안 된다.
 *
 *  - items: 1~200개, 각 원소는 `{ q: 문제 id 문자열, c: 불리언 }`만
 *  - g: 선택. 회차 코드 형식(소문자·숫자·하이픈 1~24자)
 *  - createdAt: 서버 시각으로만 찍는다
 *
 * POST /api/answer-log  { items, g? }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 보안 규칙과 같은 상한. */
const MAX_ITEMS = 200;
/** 문제 id 길이 상한 — 실제 id는 짧다. 임의의 긴 문자열 주입을 막는다. */
const MAX_QUESTION_ID_LENGTH = 64;

type Item = { q: string; c: boolean };

/** 본문의 items를 검증한다. 하나라도 형태가 어긋나면 통째로 거부한다. */
function parseItems(raw: unknown): Item[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) {
    return null;
  }
  const items: Item[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const { q, c } = entry as { q?: unknown; c?: unknown };
    if (
      typeof q !== "string" ||
      q.length === 0 ||
      q.length > MAX_QUESTION_ID_LENGTH ||
      typeof c !== "boolean"
    ) {
      return null;
    }
    items.push({ q, c });
  }
  return items;
}

export async function POST(request: NextRequest) {
  let body: { items?: unknown; g?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const items = parseItems(body.items);
  if (!items) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 회차 코드는 선택이다. 주어졌는데 형식이 틀리면 거부한다(규칙과 동일).
  let group: string | null = null;
  if (body.g !== undefined) {
    group = typeof body.g === "string" ? normalizeGroupCode(body.g) : null;
    if (!group) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  }

  try {
    await db.collection(ANSWER_LOGS_COLLECTION).add({
      items,
      createdAt: FieldValue.serverTimestamp(),
      ...(group ? { g: group } : {}),
    });
  } catch {
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
