import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { getSession } from "@/lib/server/sessionRegistry";
import { normalizeGroupCode } from "@/lib/utils/groupCode";

/**
 * 공개 — 교육생 기기가 "이 회차, 지금 유효한가? 설문을 받나?"를 묻는다.
 *
 * 설문을 켜고 끄는 힘을 **링크에서 서버로** 옮기기 위한 라우트다. 예전에는
 * 주소의 `&s=1`이 그 역할을 했고, 교육생이 직접 붙여도 설문이 열렸다.
 * 이제 켜는 쪽도 끄는 쪽도 등록부가 정한다.
 *
 * 돌려주는 것은 **참/거짓 두 개뿐**이다. 교육반 이름·응답 수처럼 관리자만
 * 볼 것은 담지 않는다. 그래도 "그 코드가 있는지"는 알려 주게 되므로, 코드를
 * 찍어 보며 유효한 회차를 찾아내는 시도 자체는 가능하다. 알아낸 뒤에 할 수
 * 있는 일이 응답을 한 건 더 넣는 것뿐이고 그건 상한으로 묶어 두었다.
 *
 * GET /api/session?code=1124-eumju-7k2 → { ok, survey }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 조회 실패·미설정은 전부 "없는 회차"로 답한다 — 화면 동작이 같기 때문이다. */
const CLOSED = { ok: false, survey: false } as const;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("code") ?? "";
  const code = normalizeGroupCode(raw);
  if (!code) {
    return NextResponse.json(CLOSED, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(CLOSED, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const session = await getSession(db, code);
    if (!session || Date.now() > session.expiresAt) {
      return NextResponse.json(CLOSED, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json(
      { ok: true, survey: session.survey },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(CLOSED, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
