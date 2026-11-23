import { AdminSessionExpiredError } from "@/lib/services/adminStatsService";

/**
 * 관리자 화면 → 출제 세트 보관함 라우트(`/api/admin/question-sets`).
 *
 * 1000문제에서 고르는 일이 이 기능의 유일한 수고다. 한 번 고른 묶음을 서버에
 * 남겨 두면 다음 교육에서는 목록에서 고르기만 하면 된다. 관리자 기기가 아니라
 * 서버에 두는 이유는 회차 등록부와 같다 — 기기를 바꿔도 그대로 보여야 한다.
 */

/** 보관된 세트 1건(서버가 내려주는 형태). */
export interface QuestionSet {
  id: string;
  name: string;
  /** 문제 id 목록 — 적어 둔 순서가 출제 순서다. */
  picks: string[];
  /** epoch ms */
  createdAt: number;
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

/** 보관된 세트를 최신순으로 읽는다. */
export async function loadQuestionSets(): Promise<QuestionSet[]> {
  const res = await fetch("/api/admin/question-sets", { cache: "no-store" });

  if (res.status === 401) throw new AdminSessionExpiredError();
  if (!res.ok) {
    throw new Error(await readError(res, "세트를 불러오지 못했습니다."));
  }

  const body = (await res.json()) as { sets?: QuestionSet[] };
  return Array.isArray(body.sets) ? body.sets : [];
}

/** 고른 문제를 이름 붙여 저장한다. */
export async function saveQuestionSet(options: {
  name: string;
  picks: string[];
}): Promise<QuestionSet> {
  const res = await fetch("/api/admin/question-sets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(options),
  });

  if (res.status === 401) throw new AdminSessionExpiredError();
  if (!res.ok) {
    throw new Error(await readError(res, "세트를 저장하지 못했습니다."));
  }

  const body = (await res.json()) as { set: QuestionSet };
  return body.set;
}

/**
 * 세트를 지운다. 이미 발급된 회차의 출제 내용은 영향받지 않는다
 * (회차는 문제 목록을 값으로 갖고 있다).
 */
export async function deleteQuestionSet(id: string): Promise<void> {
  const res = await fetch(
    `/api/admin/question-sets?id=${encodeURIComponent(id)}`,
    { method: "DELETE", cache: "no-store" },
  );

  if (res.status === 401) throw new AdminSessionExpiredError();
  if (!res.ok) {
    throw new Error(await readError(res, "세트를 지우지 못했습니다."));
  }
}
