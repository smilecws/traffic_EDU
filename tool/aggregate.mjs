// 익명 오답 집계 도구 (독립 Node 스크립트, GitHub Action이 실행)
//
// wrong_answer_logs(Firestore, 익명) 전체를 읽어 questionId별 오답 횟수를 세고,
// Top 50을 뽑아 repo 루트의 aggregates.json으로 출력한다.
//
// 출력에는 questionId·wrongCount만 담는다. selectedIds/createdAt 등 원시 로그·
// 개인 식별 정보는 절대 출력하지 않는다.
//
// 인증은 환경변수 FIREBASE_SERVICE_ACCOUNT(서비스 계정 JSON 문자열)로만 한다.

import admin from "firebase-admin";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOP_N = 50;

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

  // 전체 익명 오답 로그를 읽어 questionId별 횟수 맵 구성
  const snapshot = await db.collection("wrong_answer_logs").get();

  const counts = new Map(); // Map<questionId, number>
  snapshot.forEach((doc) => {
    const questionId = doc.get("questionId");
    if (typeof questionId !== "string" || questionId.length === 0) return;
    counts.set(questionId, (counts.get(questionId) ?? 0) + 1);
  });

  // 횟수 내림차순 정렬, 동률은 questionId 사전순(결정적 타이브레이크) → 상위 TOP_N
  const top = Array.from(counts.entries())
    .map(([questionId, wrongCount]) => ({ questionId, wrongCount }))
    .sort((a, b) =>
      b.wrongCount - a.wrongCount || a.questionId.localeCompare(b.questionId),
    )
    .slice(0, TOP_N);

  const output = {
    updatedAt: new Date().toISOString(),
    totalWrongLogs: snapshot.size,
    top,
  };

  // repo 루트의 aggregates.json으로 출력 (스크립트는 repo 루트의 tool/ 에 위치)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = join(__dirname, "..", "aggregates.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(`총 오답 로그 문서 수: ${snapshot.size}`);
  console.log(`고유 questionId 수: ${counts.size}`);
  if (top.length > 0) {
    console.log(`Top 1: ${top[0].questionId} (${top[0].wrongCount}회)`);
  }
  console.log(`Top ${top.length} 산출 완료 → ${outPath}`);
}

main().catch((err) => {
  console.error("집계 실패:", err);
  process.exit(1);
});
