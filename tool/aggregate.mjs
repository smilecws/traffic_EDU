// 익명 오답률 집계 도구 (독립 Node 스크립트, GitHub Action이 실행)
//
// answer_logs(Firestore, 익명) 전체를 읽어 questionId별 시도수(attempts)와
// 오답수(wrong)를 누적하고, 오답률(wrongRate = wrong/attempts) 기준 Top 50을
// 뽑아 repo 루트의 aggregates.json으로 출력한다.
//
// 출력에는 questionId·attempts·wrong·wrongRate만 담는다. 원시 items·createdAt 등
// 원시 로그·개인 식별 정보는 절대 출력하지 않는다.
//
// 인증은 환경변수 FIREBASE_SERVICE_ACCOUNT(서비스 계정 JSON 문자열)로만 한다.

import admin from "firebase-admin";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOP_N = 50;
const MIN_ATTEMPTS = 1; // 개발 중엔 1(사실상 전체). 프로덕션 최종엔 5로 올릴 것.

function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT 환경변수가 없습니다. 서비스 계정 JSON 문자열을 설정하세요.",
    );
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT 값이 올바른 JSON이 아닙니다.");
    process.exit(1);
  }
  return parsed;
}

async function main() {
  const serviceAccount = loadCredential();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();

  // 전체 익명 답안 로그를 읽어 questionId별 attempts/wrong 맵 구성
  const snapshot = await db.collection("answer_logs").get();

  const attempts = new Map(); // Map<questionId, number>
  const wrong = new Map(); // Map<questionId, number>

  snapshot.forEach((doc) => {
    const items = doc.get("items");
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const q = item.q;
      if (typeof q !== "string" || q.length === 0) continue;
      attempts.set(q, (attempts.get(q) ?? 0) + 1);
      if (item.c === false) {
        wrong.set(q, (wrong.get(q) ?? 0) + 1);
      }
    }
  });

  // MIN_ATTEMPTS 필터 후 오답률 산출
  const candidates = [];
  for (const [questionId, attemptCount] of attempts.entries()) {
    if (attemptCount < MIN_ATTEMPTS) continue;
    const wrongCount = wrong.get(questionId) ?? 0;
    const wrongRate = Math.round((wrongCount / attemptCount) * 10000) / 10000;
    candidates.push({
      questionId,
      attempts: attemptCount,
      wrong: wrongCount,
      wrongRate,
    });
  }

  // 정렬: wrongRate 내림차순 → attempts 내림차순 → questionId 사전순(결정적)
  candidates.sort(
    (a, b) =>
      b.wrongRate - a.wrongRate ||
      b.attempts - a.attempts ||
      a.questionId.localeCompare(b.questionId),
  );

  const top = candidates.slice(0, TOP_N);

  const output = {
    updatedAt: new Date().toISOString(),
    totalSessions: snapshot.size,
    minAttempts: MIN_ATTEMPTS,
    top,
  };

  // repo 루트의 aggregates.json으로 출력 (스크립트는 repo 루트의 tool/ 에 위치)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = join(__dirname, "..", "aggregates.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(`총 answer_logs 문서 수: ${snapshot.size}`);
  console.log(`후보 questionId 수(attempts >= ${MIN_ATTEMPTS}): ${candidates.length}`);
  if (top.length > 0) {
    const t = top[0];
    console.log(
      `Top 1: ${t.questionId} (오답률 ${t.wrongRate}, ${t.wrong}/${t.attempts})`,
    );
  }
  console.log(`Top ${top.length} 산출 완료 → ${outPath}`);
}

main().catch((err) => {
  console.error("집계 실패:", err);
  process.exit(1);
});
