import { AdminSessionExpiredError } from "@/lib/services/adminStatsService";

/**
 * 관리자 화면 → 회차 등록부 라우트(`/api/admin/sessions`).
 *
 * 회차 발급은 이제 서버가 한다. 브라우저가 코드를 만들어 자기 기기에만 적던
 * 시절에는 기기를 바꾸면 회차가 사라졌고, 같은 코드가 두 번 나와도 알 수 없었다.
 */

/** 등록된 회차 1건(서버가 내려주는 형태). */
export interface AdminSession {
  code: string;
  /** 발급 시 입력한 교육반 원문(한글일 수 있다). */
  branch: string;
  survey: boolean;
  /** epoch ms */
  issuedAt: number;
  /** epoch ms — 발급일 KST 자정 */
  expiresAt: number;
  surveyCount: number;
  /** 발급일(KST, `yyyy-MM-dd`) */
  date: string;
}

/** 서버 응답에서 에러 메시지를 꺼낸다(없으면 기본 문구). */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // JSON이 아닌 응답 — 기본 문구로
  }
  return fallback;
}

/** 새 회차를 발급한다. 교육반을 알아볼 수 없으면 에러 메시지를 던진다. */
export async function issueSession(options: {
  branch: string;
  survey: boolean;
}): Promise<AdminSession> {
  const res = await fetch("/api/admin/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(options),
  });

  if (res.status === 401) throw new AdminSessionExpiredError();
  if (!res.ok) throw new Error(await readError(res, "회차를 발급하지 못했습니다."));

  const body = (await res.json()) as { session: AdminSession };
  return body.session;
}

/** 최근 발급한 회차를 최신순으로 읽는다. */
export async function loadRecentSessions(limit = 20): Promise<AdminSession[]> {
  const res = await fetch(`/api/admin/sessions?limit=${limit}`, {
    cache: "no-store",
  });

  if (res.status === 401) throw new AdminSessionExpiredError();
  if (!res.ok) {
    throw new Error(await readError(res, "발급 내역을 불러오지 못했습니다."));
  }

  const body = (await res.json()) as { sessions?: AdminSession[] };
  return Array.isArray(body.sessions) ? body.sessions : [];
}
