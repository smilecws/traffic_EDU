import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import {
  recordSurveyResponse,
  type SurveyRejection,
} from "@/lib/server/sessionRegistry";
import { normalizeGroupCode } from "@/lib/utils/groupCode";
import { normalizeComment, parseRatings } from "@/lib/utils/survey";

/**
 * 공개 — 교육 만족도 응답 제출.
 *
 * 예전에는 브라우저가 Firestore에 직접 썼다. 보안 규칙은 "코드 형식이 맞는가,
 * 점수가 1~5인가"까지만 볼 수 있어서, **발급되지 않은 코드로도, 설문을 켜지
 * 않은 회차에도** 응답이 들어갔다. 규칙만으로는 "이 회차가 설문을 받기로 한
 * 회차인가"를 알 수 없기 때문이다(다른 문서를 읽어야 안다).
 *
 * 그래서 쓰기를 서버로 옮겼다. 이제 `survey_responses`는 보안 규칙에서 클라이언트
 * 쓰기가 막혀 있고, 서비스 계정을 쓰는 이 라우트만이 기록할 수 있다.
 *
 * POST /api/survey  { code, ratings, comment? }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 거부 사유 → 교육생에게 보여 줄 문구. */
const REJECTION_MESSAGE: Record<SurveyRejection, string> = {
  unknown: "이 회차를 찾을 수 없습니다. 교육장에서 받은 QR로 다시 들어와 주세요.",
  closed: "이 회차는 만족도 조사를 받지 않습니다.",
  expired: "조사가 마감되었습니다. 교육 당일에만 응답할 수 있습니다.",
  full: "응답이 한도에 도달해 더 받을 수 없습니다.",
};

export async function POST(request: NextRequest) {
  let body: { code?: unknown; ratings?: unknown; comment?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const code = normalizeGroupCode(
    typeof body.code === "string" ? body.code : "",
  );
  if (!code) {
    return NextResponse.json(
      { error: "회차 코드가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const ratings = parseRatings(body.ratings);
  if (!ratings) {
    return NextResponse.json(
      { error: "모든 문항에 답해 주세요." },
      { status: 400 },
    );
  }

  const comment = normalizeComment(
    typeof body.comment === "string" ? body.comment : "",
  );

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "지금은 응답을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 },
    );
  }

  let result;
  try {
    result = await recordSurveyResponse(db, code, { ratings, comment });
  } catch {
    return NextResponse.json(
      { error: "응답을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  if (!result.ok) {
    // 409 — 요청 자체는 멀쩡하고 회차 상태 때문에 받을 수 없다는 뜻.
    return NextResponse.json(
      { error: REJECTION_MESSAGE[result.reason], reason: result.reason },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
