import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionValue,
  isAdminConfigured,
  verifyPassword,
  verifySessionValue,
} from "@/lib/server/adminAuth";

/** 서비스 계정·비밀번호는 Node 런타임 환경변수로만 다룬다. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 비밀번호 오입력 시 지연(ms) — 자동 대입 공격 속도를 늦춘다. */
const WRONG_PASSWORD_DELAY_MS = 700;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 현재 세션이 유효한지 확인한다(화면 진입 시 호출). */
export async function GET(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "unconfigured" },
      { status: 503 },
    );
  }
  const valid = verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({ ok: valid }, { status: valid ? 200 : 401 });
}

/** 비밀번호를 검증하고 세션 쿠키를 발급한다. */
export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "unconfigured" },
      { status: 503 },
    );
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    // 본문 파싱 실패 → 빈 비밀번호로 간주(아래에서 거부)
  }

  if (!verifyPassword(password)) {
    await sleep(WRONG_PASSWORD_DELAY_MS);
    return NextResponse.json(
      { ok: false, reason: "invalid" },
      { status: 401 },
    );
  }

  const value = createSessionValue();
  if (!value) {
    return NextResponse.json(
      { ok: false, reason: "unconfigured" },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

/** 로그아웃 — 쿠키를 즉시 만료시킨다. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
