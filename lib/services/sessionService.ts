/**
 * 교육생 기기 → 서버 회차 확인.
 *
 * QR로 막 들어온 기기가 "이 회차가 지금 유효한지, 설문을 받는지"를 서버에
 * 묻는다. 답을 못 받으면(오프라인·서버 오류) **닫힌 것으로 본다** — 설문을
 * 켜지 않은 회차에 버튼이 떠서 눌러 봐야 거부당하는 쪽보다, 안 뜨는 쪽이 낫다.
 * 회차 코드 자체는 이 확인과 무관하게 이미 저장돼 있어 오답 집계는 영향받지 않는다.
 */

/** 서버가 알려 주는 회차 상태. */
export interface SessionState {
  /** 등록돼 있고 아직 유효한 회차인지. */
  ok: boolean;
  /** 만족도 조사를 받는 회차인지. */
  survey: boolean;
}

/** 확인 실패 시의 기본값 — 닫힌 회차로 취급한다. */
const CLOSED: SessionState = { ok: false, survey: false };

/** 회차 코드를 서버에 확인한다. 실패하면 닫힌 것으로 답한다(throw하지 않는다). */
export async function fetchSessionState(code: string): Promise<SessionState> {
  try {
    const res = await fetch(`/api/session?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
    if (!res.ok) return CLOSED;
    const body = (await res.json()) as { ok?: unknown; survey?: unknown };
    return { ok: body.ok === true, survey: body.survey === true };
  } catch {
    return CLOSED;
  }
}
