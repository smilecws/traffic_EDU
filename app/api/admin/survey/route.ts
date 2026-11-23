import { NextResponse, type NextRequest } from "next/server";
import { Timestamp, type Query } from "firebase-admin/firestore";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/server/adminAuth";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { DATE_PATTERN, kstDayBoundary } from "@/lib/utils/kstDate";

/**
 * 관리자 전용 — 교육 만족도 응답 집계.
 *
 * 보안 규칙이 `survey_responses` 읽기를 전면 차단하므로, 이 라우트가 서비스
 * 계정으로 읽어 **문항별 분포와 주관식 목록만** 내려준다. 응답 시각은 담지
 * 않는다 — 시각 + 회차를 합치면 "몇 번째로 제출한 사람"을 좁힐 수 있고,
 * 익명 설문에서 그 정보는 쓸 데가 없다.
 *
 * 범위는 통계 라우트와 같다.
 * - 회차별(기본): `GET /api/admin/survey?code=1124-chuncheon-7k2&from=…&to=…`
 * - 회차 무관: `?scope=all` (기간 지정 또는 전체 기간)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** groupCodeService.ts·보안 규칙과 동일한 형식 제한. */
const CODE_PATTERN = /^[a-z0-9-]{1,24}$/;

/** 집계하는 척도 문항 id — surveyService의 SURVEY_QUESTIONS와 같게 유지할 것. */
const RATING_IDS = ["overall", "useful", "instructor"] as const;

/** 내려줄 주관식 상한. 한 회차 수십 명 규모라 넉넉하다. */
const MAX_COMMENTS = 500;

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
    let query: Query = db.collection("survey_responses");
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
      { error: "만족도 응답을 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  // 문항별 1~5 분포. 인덱스 0이 1점이다.
  const distributions: Record<string, number[]> = {};
  for (const id of RATING_IDS) distributions[id] = [0, 0, 0, 0, 0];
  const comments: string[] = [];

  snapshot.forEach((doc) => {
    const ratings = doc.get("ratings");
    if (ratings && typeof ratings === "object") {
      for (const id of RATING_IDS) {
        const score = (ratings as Record<string, unknown>)[id];
        // 규칙이 1~5를 강제하지만, 규칙 변경 전에 들어온 문서도 깨지지 않게 막는다.
        if (typeof score === "number" && score >= 1 && score <= 5) {
          distributions[id][Math.round(score) - 1] += 1;
        }
      }
    }

    const comment = doc.get("comment");
    if (typeof comment === "string" && comment.length > 0) {
      if (comments.length < MAX_COMMENTS) comments.push(comment);
    }
  });

  return NextResponse.json(
    {
      scope,
      code: scope === "all" ? "" : code,
      from: scope === "group" || hasRange ? from : "",
      to: scope === "group" || hasRange ? to : "",
      responses: snapshot.size,
      distributions,
      comments,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
