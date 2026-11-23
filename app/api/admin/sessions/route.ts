import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/server/adminAuth";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import {
  issueSession,
  listRecentSessions,
  type SessionRecord,
} from "@/lib/server/sessionRegistry";

/**
 * 관리자 전용 — 교육 회차 발급과 발급 내역 조회.
 *
 * 발급은 **서버에서** 한다. 예전에는 브라우저가 코드를 만들어 자기 기기에만
 * 적어 뒀는데, 그러면 기기를 바꾸는 순간 회차가 사라지고 같은 코드가 두 번
 * 나와도 알 길이 없었다. 지금은 서버가 코드를 만들고, 이미 쓰인 코드면 다시
 * 뽑고, 등록부(`sessions`)에 적은 뒤 돌려준다.
 *
 * 교육반·교수자 이름(`branch`)은 **선택**이다. 비워도 발급된다 — 이름은 관리자가
 * 목록에서 알아보기 위한 메모이고, 회차를 식별하는 것은 코드다.
 *
 * POST /api/admin/sessions   { branch?, survey }  → 새 회차
 * GET  /api/admin/sessions?limit=20               → 최근 발급 내역
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 최근 발급 내역 기본·최대 건수. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** 서비스 계정 미설정 안내 — 발급도 조회도 Admin SDK 없이는 불가능하다. */
function unconfigured() {
  return NextResponse.json(
    {
      error:
        "서버에 FIREBASE_SERVICE_ACCOUNT가 설정되지 않아 회차를 다룰 수 없습니다.",
    },
    { status: 503 },
  );
}

/** 화면에 내려보낼 형태 — 등록부 레코드를 그대로 쓴다. */
type SessionPayload = SessionRecord;

export async function GET(request: NextRequest) {
  if (!verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = Number(request.nextUrl.searchParams.get("limit"));
  const limit =
    Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), MAX_LIMIT) : DEFAULT_LIMIT;

  const db = getAdminDb();
  if (!db) return unconfigured();

  let sessions: SessionPayload[];
  try {
    sessions = await listRecentSessions(db, limit);
  } catch {
    return NextResponse.json(
      { error: "발급 내역을 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { sessions },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let branch = "";
  let survey = false;
  try {
    const body = (await request.json()) as {
      branch?: unknown;
      survey?: unknown;
    };
    if (typeof body.branch === "string") branch = body.branch;
    survey = body.survey === true;
  } catch {
    // 본문 파싱 실패 → 이름 없이, 설문 없이 발급한다(둘 다 선택이다)
  }

  // 이름은 선택이다 — 비워도 발급한다. 회차를 식별하는 것은 코드다.
  const db = getAdminDb();
  if (!db) return unconfigured();

  let session: SessionPayload | null;
  try {
    session = await issueSession(db, { branch, survey });
  } catch {
    return NextResponse.json(
      { error: "회차를 발급하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  if (!session) {
    return NextResponse.json(
      { error: "회차 코드를 만들지 못했습니다. 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { session },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
