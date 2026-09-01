// 학과시험 문제[한국어] 게시판 변경 감시 (독립 Node 스크립트, GitHub Action이 실행)
//
// https://www.safedriving.or.kr/subExamBoard/selectSubExamBoardKorList.do 목록을 읽어
// 글ID·제목·등록일을 뽑고, 이전 상태(exam-board-state.json)와 비교해 변경을 감지한다.
//
// 조회수는 매 조회마다 바뀌므로 감시 대상에서 제외한다(오탐 방지).
// 첨부파일 자체는 상세 페이지에 있고 NetFunnel(대기열/봇 차단)로 직접 접근이 막혀 있다.
// 다만 KOROAD가 첨부를 교체할 때는 글을 새로 올리거나 수정하므로
// 목록의 글ID·제목·등록일 변화가 사실상 첨부 변경 신호가 된다.
//
// 사용법:
//   node check-exam-board.mjs [이전상태.json]
// 출력:
//   exam-board-state.json  — 이번 조회 결과(항상 기록)
//   changes.md             — 변경이 있을 때만 기록(사람이 읽을 diff)
// 종료 코드:
//   0 변경 없음 / 0 변경 있음(changes.md 존재로 구분) / 1 조회 실패

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LIST_URL =
  "https://www.safedriving.or.kr/subExamBoard/selectSubExamBoardKorList.do";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 목록 페이지 HTML을 가져온다. 실패 시 재시도 후 throw. */
async function fetchList() {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(LIST_URL, {
        headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      console.error(`조회 실패(${attempt}/${MAX_ATTEMPTS}): ${err.message}`);
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

/**
 * 목록 표에서 글ID·제목·등록일을 뽑는다.
 * 조회수는 의도적으로 무시한다(매 조회마다 증가 → 오탐).
 */
function parseRows(html) {
  const table = html.match(/<table[^>]*id="noticeTable"[\s\S]*?<\/table>/i);
  const scope = table ? table[0] : html;

  const rows = [];
  for (const tr of scope.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const idMatch = tr.match(/fnGoDetail\(\s*["'](\d+)["']\s*\)/);
    if (!idMatch) continue; // thead 등 데이터가 아닌 행

    const titleMatch = tr.match(/fnGoDetail\([^)]*\);?['"]\s*>([\s\S]*?)<\/a>/);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      : "";

    const dateMatch = tr.match(/(\d{4}-\d{2}-\d{2})/);

    rows.push({
      id: idMatch[1],
      title,
      date: dateMatch ? dateMatch[1] : "",
    });
  }
  return rows;
}

/** 감시 대상 필드만 담은 비교용 문자열. */
function fingerprint(rows) {
  return rows
    .map((r) => `${r.id}\t${r.title}\t${r.date}`)
    .sort()
    .join("\n");
}

/** 이전/현재 행을 비교해 추가·삭제·수정 목록을 만든다. */
function diffRows(before, after) {
  const beforeById = new Map(before.map((r) => [r.id, r]));
  const afterById = new Map(after.map((r) => [r.id, r]));

  const added = after.filter((r) => !beforeById.has(r.id));
  const removed = before.filter((r) => !afterById.has(r.id));
  const modified = [];
  for (const cur of after) {
    const prev = beforeById.get(cur.id);
    if (!prev) continue;
    if (prev.title !== cur.title || prev.date !== cur.date) {
      modified.push({ prev, cur });
    }
  }
  return { added, removed, modified };
}

/** 사람이 읽을 변경 요약(Markdown)을 만든다. */
function renderChanges({ added, removed, modified }, after) {
  const lines = [];
  lines.push(
    "한국도로교통공단 **학과시험 문제[한국어]** 게시판에 변경이 감지되었습니다.",
    "",
    `출처: ${LIST_URL}`,
    "",
  );

  if (added.length > 0) {
    lines.push("## 새 글", "");
    for (const r of added) lines.push(`- **${r.title}** (등록일 ${r.date}, 글ID ${r.id})`);
    lines.push("");
  }
  if (modified.length > 0) {
    lines.push("## 수정된 글", "");
    for (const { prev, cur } of modified) {
      lines.push(`- 글ID ${cur.id}`);
      if (prev.title !== cur.title) {
        lines.push(`  - 제목: \`${prev.title}\` → \`${cur.title}\``);
      }
      if (prev.date !== cur.date) {
        lines.push(`  - 등록일: \`${prev.date}\` → \`${cur.date}\``);
      }
    }
    lines.push("");
  }
  if (removed.length > 0) {
    lines.push("## 사라진 글", "");
    for (const r of removed) lines.push(`- **${r.title}** (등록일 ${r.date}, 글ID ${r.id})`);
    lines.push("");
  }

  lines.push("## 현재 목록 전체", "");
  lines.push("| 글ID | 제목 | 등록일 |", "| --- | --- | --- |");
  for (const r of after) lines.push(`| ${r.id} | ${r.title} | ${r.date} |`);
  lines.push("");
  lines.push(
    "> 첨부파일이 교체되면 보통 글이 새로 올라오거나 수정됩니다.",
    "> 위 글을 열어 첨부파일을 확인하고, 문제은행이 갱신되었다면",
    "> `public/data/questions_kor.json` 반영이 필요한지 검토하세요.",
  );
  return lines.join("\n");
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outStatePath = join(scriptDir, "..", "exam-board-state.json");
  const outChangesPath = join(scriptDir, "..", "changes.md");
  const prevPath = process.argv[2];

  const html = await fetchList();
  const rows = parseRows(html);

  // 0건이면 조회 실패로 간주한다. 에러 페이지·차단 응답을 "전체 삭제"로
  // 오인해 거짓 알림을 보내는 것을 막는다.
  if (rows.length === 0) {
    console.error(
      "목록에서 글을 하나도 파싱하지 못했습니다. 페이지 구조 변경 또는 차단 응답으로 보입니다.",
    );
    process.exit(1);
  }

  const state = {
    checkedAt: new Date().toISOString(),
    source: LIST_URL,
    count: rows.length,
    rows,
  };
  writeFileSync(outStatePath, JSON.stringify(state, null, 2) + "\n", "utf8");
  console.log(`현재 글 ${rows.length}건 파싱 완료`);
  for (const r of rows) console.log(`  ${r.id}\t${r.date}\t${r.title}`);

  if (!prevPath || !existsSync(prevPath)) {
    console.log("이전 상태가 없습니다 — 최초 실행으로 보고 기준선만 기록합니다.");
    return;
  }

  let prev;
  try {
    prev = JSON.parse(readFileSync(prevPath, "utf8"));
  } catch {
    console.log("이전 상태를 읽지 못했습니다 — 기준선을 새로 기록합니다.");
    return;
  }

  const prevRows = Array.isArray(prev.rows) ? prev.rows : [];
  if (fingerprint(prevRows) === fingerprint(rows)) {
    console.log("변경 없음.");
    return;
  }

  const diff = diffRows(prevRows, rows);
  writeFileSync(outChangesPath, renderChanges(diff, rows) + "\n", "utf8");
  console.log(
    `변경 감지 — 추가 ${diff.added.length} / 수정 ${diff.modified.length} / 삭제 ${diff.removed.length}`,
  );
}

main().catch((err) => {
  console.error("감시 실패:", err);
  process.exit(1);
});
