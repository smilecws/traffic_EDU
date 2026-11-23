import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/server/adminAuth";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import {
  MAX_SETS,
  SET_NAME_MAX_LENGTH,
  createQuestionSet,
  deleteQuestionSet,
  listQuestionSets,
  type QuestionSetRecord,
} from "@/lib/server/questionSetRegistry";

/**
 * 관리자 전용 — 출제 세트 보관함.
 *
 * 1000문제에서 고르는 일이 이 기능의 유일한 수고다. 한 번 고른 묶음에 이름을
 * 붙여 두면 다음 교육에서는 목록에서 고르기만 하면 된다.
 *
 * GET    /api/admin/question-sets          → 보관된 세트(최신순)
 * POST   /api/admin/question-sets          { name, picks } → 새 세트
 * DELETE /api/admin/question-sets?id=...   → 세트 삭제
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 서비스 계정 미설정 안내 — 보관함도 Admin SDK 없이는 다룰 수 없다. */
function unconfigured() {
  return NextResponse.json(
    {
      error:
        "서버에 FIREBASE_SERVICE_ACCOUNT가 설정되지 않아 세트를 다룰 수 없습니다.",
    },
    { status: 503 },
  );
}

/** 관리자 세션 확인 — 통과하면 null, 아니면 401 응답. */
function requireAdmin(request: NextRequest): NextResponse | null {
  if (verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value)) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const db = getAdminDb();
  if (!db) return unconfigured();

  let sets: QuestionSetRecord[];
  try {
    sets = await listQuestionSets(db);
  } catch {
    return NextResponse.json(
      { error: "세트를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { sets },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let name = "";
  let picks: unknown = [];
  try {
    const body = (await request.json()) as { name?: unknown; picks?: unknown };
    if (typeof body.name === "string") name = body.name;
    picks = body.picks;
  } catch {
    // 본문 파싱 실패 → 아래 검증에서 거부된다
  }

  const db = getAdminDb();
  if (!db) return unconfigured();

  let result: Awaited<ReturnType<typeof createQuestionSet>>;
  try {
    result = await createQuestionSet(db, { name, picks });
  } catch {
    return NextResponse.json(
      { error: "세트를 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      name: `세트 이름을 입력해 주세요(최대 ${SET_NAME_MAX_LENGTH}자).`,
      picks: "세트에 담을 문제를 한 문제 이상 고르세요.",
      full: `세트는 ${MAX_SETS}개까지 보관할 수 있습니다. 쓰지 않는 세트를 지워 주세요.`,
    };
    return NextResponse.json(
      { error: messages[result.reason] },
      { status: result.reason === "full" ? 409 : 400 },
    );
  }

  return NextResponse.json({ set: result.set }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json(
      { error: "지울 세트를 지정해 주세요." },
      { status: 400 },
    );
  }

  const db = getAdminDb();
  if (!db) return unconfigured();

  try {
    await deleteQuestionSet(db, id);
  } catch {
    return NextResponse.json(
      { error: "세트를 지우지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
