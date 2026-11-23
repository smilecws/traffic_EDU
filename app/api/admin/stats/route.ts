import { NextResponse, type NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/server/adminAuth";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { DATE_PATTERN, kstDayBoundary } from "@/lib/utils/kstDate";

/**
 * 관리자 전용 — 교육 회차(그룹)별 문항 집계.
 *
 * 브라우저는 Firestore를 직접 읽지 않는다. 이 라우트가 서비스 계정으로 읽어
 * **문항별 시도/오답 수만** 돌려준다. 원시 로그(createdAt, 세션 구성 등)는
 * 응답에 담지 않는다.
 *
 * GET /api/admin/stats?code=1124a&from=2026-11-24&to=2026-11-24
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** groupCodeService.ts·보안 규칙과 동일한 형식 제한. */
const CODE_PATTERN = /^[a-z0-9-]{1,24}$/;

export async function GET(request: NextRequest) {
  if (!verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const code = (params.get("code") ?? "").trim().toLowerCase();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json(
      { error: "회차 코드 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return NextResponse.json(
      { error: "날짜 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      {
        error:
          "서버에 FIREBASE_SERVICE_ACCOUNT가 설정되지 않아 조회할 수 없습니다.",
      },
      { status: 503 },
    );
  }

  let snapshot;
  try {
    snapshot = await db
      .collection("answer_logs")
      .where("g", "==", code)
      .where("createdAt", ">=", Timestamp.fromDate(kstDayBoundary(from, "start")))
      .where("createdAt", "<=", Timestamp.fromDate(kstDayBoundary(to, "end")))
      .get();
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // 복합 색인 미생성 — 배포 명령을 안내한다.
    if (message.includes("index")) {
      return NextResponse.json(
        {
          error:
            "Firestore 색인이 없습니다. firebase deploy --only firestore:indexes 를 실행한 뒤 다시 조회하세요.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "집계를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const attempts = new Map<string, number>();
  const wrong = new Map<string, number>();

  snapshot.forEach((doc) => {
    const items = doc.get("items");
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const q = (item as { q?: unknown }).q;
      if (typeof q !== "string" || q.length === 0) continue;
      attempts.set(q, (attempts.get(q) ?? 0) + 1);
      if ((item as { c?: unknown }).c === false) {
        wrong.set(q, (wrong.get(q) ?? 0) + 1);
      }
    }
  });

  const counts = [...attempts.entries()].map(([questionId, attemptCount]) => ({
    questionId,
    attempts: attemptCount,
    wrong: wrong.get(questionId) ?? 0,
  }));

  return NextResponse.json(
    { code, from, to, sessions: snapshot.size, counts },
    { headers: { "Cache-Control": "no-store" } },
  );
}
