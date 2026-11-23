import { NextResponse, type NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/server/adminAuth";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import {
  MONTH_PATTERN,
  kstMonthBoundary,
  toKstDateString,
} from "@/lib/utils/kstDate";

/**
 * 관리자 전용 — 한 달치 "회차가 있었던 날" 달력.
 *
 * 회차 코드는 어디에도 발급 기록이 없다. 그래서 **쌓인 로그에서 역산**한다:
 * 그 달의 `answer_logs`를 훑어 KST 날짜별로 어떤 `g`(회차 코드)가 몇 건
 * 들어왔는지 센다. 관리자는 달력에서 날짜를 눌러 그날의 회차를 고르면 되고,
 * 코드를 외우거나 적어 둘 필요가 없다.
 *
 * `.select('g', 'createdAt')`로 **필드 마스크**를 걸어 `items` 배열(최대 200개)을
 * 내려받지 않는다 — 전송량과 응답 시간이 크게 줄어든다. 단, Firestore 네이티브
 * 모드에서 필드 마스크는 **문서 읽기 과금을 줄이지 않는다**(문서 수만큼 과금).
 * 한 달치 세션이 수천 건 수준이면 무료 한도(일 5만 읽기) 안에서 충분하지만,
 * 규모가 커지면 일자별 롤업 문서를 두는 쪽으로 바꿔야 한다.
 *
 * `createdAt` 범위 쿼리는 자동 단일 필드 색인으로 처리되어 추가 색인이 필요 없다.
 *
 * GET /api/admin/calendar?month=2026-11
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 한 달에 집계할 문서 상한 — 예상 밖으로 커져도 응답 시간을 묶어 둔다. */
const MAX_DOCS = 20000;

/** 하루치 집계. */
interface DayAccumulator {
  /** 회차 코드 → 세션 수 */
  groups: Map<string, number>;
  /** 회차 코드가 없는 세션 수(교육장 밖에서 혼자 푼 응답) */
  untagged: number;
}

export async function GET(request: NextRequest) {
  if (!verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!MONTH_PATTERN.test(month)) {
    return NextResponse.json(
      { error: "월 형식이 올바르지 않습니다(yyyy-MM)." },
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
      .where(
        "createdAt",
        ">=",
        Timestamp.fromDate(kstMonthBoundary(month, "start")),
      )
      .where(
        "createdAt",
        "<=",
        Timestamp.fromDate(kstMonthBoundary(month, "end")),
      )
      .select("g", "createdAt")
      .limit(MAX_DOCS)
      .get();
  } catch {
    return NextResponse.json(
      { error: "달력을 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const byDate = new Map<string, DayAccumulator>();

  snapshot.forEach((doc) => {
    const createdAt = doc.get("createdAt");
    // serverTimestamp가 아직 확정되지 않은 문서는 건너뛴다(쓰기 직후 극히 짧은 구간).
    if (!(createdAt instanceof Timestamp)) return;

    const date = toKstDateString(createdAt.toMillis());
    const acc = byDate.get(date) ?? { groups: new Map(), untagged: 0 };

    const g = doc.get("g");
    if (typeof g === "string" && g.length > 0) {
      acc.groups.set(g, (acc.groups.get(g) ?? 0) + 1);
    } else {
      acc.untagged += 1;
    }

    byDate.set(date, acc);
  });

  const days = [...byDate.entries()]
    .map(([date, acc]) => ({
      date,
      sessions:
        acc.untagged + [...acc.groups.values()].reduce((a, b) => a + b, 0),
      untagged: acc.untagged,
      // 세션 수 많은 회차부터 — 교육 회차가 위로 오고 자잘한 건 아래로
      groups: [...acc.groups.entries()]
        .map(([code, sessions]) => ({ code, sessions }))
        .sort((a, b) => b.sessions - a.sessions || a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(
    { month, days, truncated: snapshot.size >= MAX_DOCS },
    { headers: { "Cache-Control": "no-store" } },
  );
}
