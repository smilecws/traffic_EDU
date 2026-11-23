import { NextResponse, type NextRequest } from "next/server";
import { Timestamp, type Query } from "firebase-admin/firestore";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/server/adminAuth";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { DATE_PATTERN, kstDayBoundary } from "@/lib/utils/kstDate";

/**
 * 관리자 전용 — 문항별 시도/오답 수 집계.
 *
 * 브라우저는 Firestore를 직접 읽지 않는다. 이 라우트가 서비스 계정으로 읽어
 * **문항별 시도/오답 수만** 돌려준다. 원시 로그(createdAt, 세션 구성 등)는
 * 응답에 담지 않는다.
 *
 * 두 가지 범위(scope)를 지원한다.
 * - 회차별(기본): `GET /api/admin/stats?code=1124a&from=2026-11-24&to=2026-11-24`
 * - 회차 무관(`scope=all`): 회차 코드 조건 없이 읽는다. 회차 코드 없이 들어온
 *   응답(코드 미입력 교육생·일반 사용자)까지 포함된다.
 *   - 기간 지정: `?scope=all&from=2026-11-01&to=2026-11-23`
 *   - 전체 기간: `?scope=all` (날짜를 비우면 컬렉션 전체)
 *   날짜는 둘 다 주거나 둘 다 비워야 한다. 하나만 오면 400.
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
  const scope = params.get("scope") === "all" ? "all" : "group";
  const code = (params.get("code") ?? "").trim().toLowerCase();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  // 회차 무관 조회에서 날짜는 선택이다 — 비우면 전체 기간.
  const hasRange = scope === "all" && (from !== "" || to !== "");

  if (scope === "group" || hasRange) {
    if (scope === "group" && !CODE_PATTERN.test(code)) {
      return NextResponse.json(
        { error: "회차 코드 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }
    // hasRange일 때 한쪽만 온 경우도 여기서 걸린다(빈 문자열은 패턴 불통과).
    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
      return NextResponse.json(
        { error: "날짜 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }
    if (from > to) {
      return NextResponse.json(
        { error: "시작일이 종료일보다 늦습니다." },
        { status: 400 },
      );
    }
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
    // 회차 조건(g) → 기간 조건(createdAt) 순으로 쌓는다. 회차 없이 기간만 거는
    // 조회는 createdAt 단일 필드 색인으로 충분해 복합 색인이 필요 없다.
    let query: Query = db.collection("answer_logs");
    if (scope === "group") query = query.where("g", "==", code);
    if (scope === "group" || hasRange) {
      query = query
        .where(
          "createdAt",
          ">=",
          Timestamp.fromDate(kstDayBoundary(from, "start")),
        )
        .where("createdAt", "<=", Timestamp.fromDate(kstDayBoundary(to, "end")));
    }
    snapshot = await query.get();
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
    {
      scope,
      code: scope === "all" ? "" : code,
      // 전체 기간 조회는 빈 문자열 — 화면이 "전체 기간"으로 표시한다.
      from: scope === "group" || hasRange ? from : "",
      to: scope === "group" || hasRange ? to : "",
      sessions: snapshot.size,
      counts,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
