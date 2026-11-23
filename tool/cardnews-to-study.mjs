#!/usr/bin/env node
/**
 * 카드뉴스 원문(tool/source/cardnews.md) → 학습자료 JSON(public/data/study/*.json)
 *
 *   node tool/cardnews-to-study.mjs            # 검증 리포트만 출력(드라이런)
 *   node tool/cardnews-to-study.mjs --write    # JSON 16개 + index.json 기록
 *
 * 원문 서식이 일정하지 않아(소주제 마커 A/B/C·1/2/3 혼용, 카드 헤더 인라인/분리,
 * <br>·**굵게** 혼입) 아래 규칙으로 정규화한다.
 *   - <br> → 줄바꿈, ** 제거, 선행 # 제거
 *   - 소주제 마커는 등장 순서대로 A, B, C … 재부여
 *   - "(배지: 01 · 법 / 상단라벨: xxx / 부제: yyy)" → badge/label/subtitle
 *   - [본문] → body, [핵심정리] 불릿 → key_points, 표(|…|) → comparison_tables
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "tool", "source", "cardnews.md");
const OUT_DIR = join(ROOT, "public", "data", "study");
const MARKERS = "ABCDEFGHIJ";

const RE = {
  topic: /^대주제\s*[:：]\s*(.+)$/,
  subTopic: /^소주제\s*[0-9A-Z]+\s*[:：]\s*(.+)$/,
  card: /^카드\s*(\d+)\s*[:：]\s*(.*)$/,
  meta: /^\(\s*(?:배지|상단라벨|부제)\s*[:：]?\s*\S.*$/,
  bullet: /^[*•·‧∙]\s+(.+)$/,
  sectionBody: /^\[\s*본문\s*\]\s*(.*)$/,
  sectionPoints: /^\[\s*핵심정리\s*\]\s*(.*)$/,
  // 표 섹션 표기가 [표/비교정리]·[표/도표] 등으로 흔들려 "표"로 시작하는 꼴을 모두 받는다.
  sectionTable: /^\[\s*표\s*[/·]?[^\]]*\]\s*(.*)$/,
  tableDivider: /^[:\s-]*-{3,}[:\s-]*$/,
};

/** 원문을 구조 파싱하기 쉬운 줄 목록으로 정규화한다. */
function normalize(raw) {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\*\*/g, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/ /g, " ")
        .replace(/^\s*#{1,6}\s*/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line.length > 0);
}

/** "(배지: 01 · 법 / 상단라벨: 속도 규정 / 부제: …)" 파싱 */
function parseMeta(text) {
  const meta = {};
  // 원문에 "배지: 01 · 법"과 "배지 05 · 처벌"(콜론 누락)이 섞여 있다.
  const badge = text.match(/배지\s*[:：]?\s*(\d+)?\s*[·ㆍ・•]?\s*([^/)\n]*)/);
  if (badge) {
    if (badge[1]) meta.badgeNumber = Number(badge[1]);
    const code = (badge[2] || "").trim();
    if (code) meta.badgeCode = code;
  }
  const label = text.match(/상단라벨\s*[:：]\s*([^/)\n]*)/);
  if (label && label[1].trim()) meta.label = label[1].trim();
  const subtitle = text.match(/부제\s*[:：]\s*([^/)\n]*)/);
  if (subtitle && subtitle[1].trim()) meta.subtitle = subtitle[1].trim();
  return meta;
}

/**
 * 마크다운 표 행 묶음 → [{ headers, rows }]
 * 원문에는 빈 줄 없이 표 두 개가 맞붙어 있는 곳이 있어(헤더행 + 구분행이 다시 등장)
 * 구분행(| :--- |)을 기준으로 표를 나눈다.
 */
function buildTables(rowLines, warn) {
  const cells = rowLines.map((line) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim()),
  );
  const isDivider = (row) =>
    row.length > 0 && row.every((c) => RE.tableDivider.test(c) || c === "");
  const dividers = cells.reduce(
    (acc, row, i) => (isDivider(row) ? [...acc, i] : acc),
    [],
  );

  const make = (headers, rows) => {
    const width = headers.length;
    const fixed = rows.map((row) => {
      if (row.length === width) return row;
      warn(
        `표 열 수 불일치(헤더 ${width} / 행 ${row.length}): ${row.join(" | ").slice(0, 60)}`,
      );
      return row.length > width
        ? row.slice(0, width)
        : [...row, ...Array(width - row.length).fill("")];
    });
    return { headers, rows: fixed };
  };

  if (dividers.length === 0) {
    const body = cells.filter((row) => !isDivider(row));
    if (body.length === 0) return [];
    warn(`구분행(| :--- |) 없는 표: ${body[0].join(" | ").slice(0, 50)}`);
    return [make(body[0], body.slice(1))];
  }

  const tables = [];
  dividers.forEach((d, k) => {
    if (d === 0) {
      warn("헤더 없이 구분행으로 시작하는 표를 건너뜁니다.");
      return;
    }
    const end = k + 1 < dividers.length ? dividers[k + 1] - 1 : cells.length;
    tables.push(make(cells[d - 1], cells.slice(d + 1, end)));
  });
  if (dividers[0] > 1) {
    warn(`표 앞의 떠 있는 행 ${dividers[0] - 1}개를 버렸습니다.`);
  }
  return tables;
}

function applyMeta(card, meta) {
  if (meta.badgeNumber != null) card.badge.number = meta.badgeNumber;
  if (meta.badgeCode) card.badge.code = meta.badgeCode;
  if (meta.label) card.label = meta.label;
  if (meta.subtitle) card.subtitle = meta.subtitle;
}

function parse(raw) {
  const lines = normalize(raw);
  const topics = [];
  const issues = [];
  let topic = null;
  let sub = null;
  let card = null;
  let mode = null; // body | points | table
  let tableBuf = [];
  const warn = (msg) =>
    issues.push(
      `[주제 ${topic?.id ?? "-"} / ${sub?.title ?? "-"} / ${card?.title ?? "-"}] ${msg}`,
    );

  const flushTable = () => {
    if (tableBuf.length === 0) return;
    const tables = buildTables(tableBuf, warn);
    tableBuf = [];
    if (tables.length === 0) return;
    if (!card) {
      warn("카드 밖의 표를 버렸습니다.");
      return;
    }
    for (const table of tables) {
      // 헤더가 전부 같은 표(예: "| 항목 | 항목 |")는 비교표가 아니라 목록을
      // 2단으로 늘어놓은 것이므로 핵심정리 항목으로 편다.
      const isLayout = new Set(table.headers).size === 1;
      if (isLayout) {
        warn(`목록형 표를 핵심정리로 변환(헤더: ${table.headers[0] || "없음"})`);
        for (const row of table.rows) {
          for (const cell of row) {
            const text = cell.replace(/^[*•·‧∙-]\s*/, "").trim();
            if (text) card.key_points.push(text);
          }
        }
        continue;
      }
      card.comparison_tables.push(table);
    }
  };

  for (const line of lines) {
    if (line.startsWith("|")) {
      tableBuf.push(line);
      continue;
    }
    flushTable();

    let m;
    if ((m = line.match(RE.topic))) {
      topic = { id: topics.length + 1, title: m[1].trim(), sub_topics: [] };
      topics.push(topic);
      sub = null;
      card = null;
      mode = null;
      continue;
    }
    if ((m = line.match(RE.subTopic))) {
      if (!topic) {
        issues.push(`대주제 밖 소주제: ${line.slice(0, 40)}`);
        continue;
      }
      sub = {
        marker: MARKERS[topic.sub_topics.length],
        title: m[1].trim(),
        cards: [],
      };
      topic.sub_topics.push(sub);
      card = null;
      mode = null;
      continue;
    }
    if ((m = line.match(RE.card))) {
      if (!sub) {
        issues.push(`소주제 밖 카드: ${line.slice(0, 40)}`);
        continue;
      }
      const rest = m[2].trim();
      const metaStart = rest.search(/\((?=[^)]*(?:배지|상단라벨|부제)\s*[:：])/);
      const title = (metaStart >= 0 ? rest.slice(0, metaStart) : rest)
        .trim()
        .replace(/[\s:：-]+$/, "");
      const meta = metaStart >= 0 ? parseMeta(rest.slice(metaStart)) : {};
      card = {
        number: sub.cards.length + 1,
        title,
        badge: { number: sub.cards.length + 1, code: "" },
        label: "",
        body: "",
        key_points: [],
        comparison_tables: [],
        _bodyParts: [],
      };
      applyMeta(card, meta);
      sub.cards.push(card);
      mode = null;
      continue;
    }
    if (RE.meta.test(line)) {
      if (!card) {
        issues.push(`카드 밖 메타줄: ${line.slice(0, 40)}`);
        continue;
      }
      applyMeta(card, parseMeta(line));
      continue;
    }
    if ((m = line.match(RE.sectionBody))) {
      mode = "body";
      if (m[1].trim() && card) card._bodyParts.push(m[1].trim());
      continue;
    }
    if ((m = line.match(RE.sectionPoints))) {
      mode = "points";
      if (m[1].trim() && card) card.key_points.push(m[1].trim());
      continue;
    }
    if (RE.sectionTable.test(line)) {
      mode = "table";
      continue;
    }
    // 처리하지 못한 섹션 마커가 본문에 섞이지 않도록 걸러서 보고한다.
    if (/^\[[^\]]{1,15}\]$/.test(line)) {
      issues.push(`알 수 없는 섹션 마커(버림): ${line}`);
      continue;
    }
    if ((m = line.match(RE.bullet))) {
      if (!card) {
        issues.push(`카드 밖 불릿: ${line.slice(0, 40)}`);
        continue;
      }
      card.key_points.push(m[1].trim());
      continue;
    }
    if (!card) {
      issues.push(`분류되지 않은 줄: ${line.slice(0, 60)}`);
      continue;
    }
    if (mode === "body" || mode === null) card._bodyParts.push(line);
    else card.key_points.push(line);
  }
  flushTable();

  for (const t of topics) {
    for (const s of t.sub_topics) {
      for (const c of s.cards) {
        c.body = c._bodyParts.join(" ").replace(/\s+/g, " ").trim();
        delete c._bodyParts;
        c.key_points = c.key_points
          .map((p) => p.replace(/\s+/g, " ").trim())
          .filter(Boolean);
      }
    }
  }
  return { topics, issues };
}

/** 스키마 순서를 고정해 직렬화 대상 객체를 만든다. */
function toJson(topic) {
  return {
    id: topic.id,
    title: topic.title,
    sub_topics: topic.sub_topics.map((s) => ({
      marker: s.marker,
      title: s.title,
      cards: s.cards.map((c) => {
        const card = {
          number: c.number,
          title: c.title,
          badge: { number: c.badge.number, code: c.badge.code },
          label: c.label,
          body: c.body,
          key_points: c.key_points,
          comparison_tables: c.comparison_tables,
        };
        if (c.subtitle) card.subtitle = c.subtitle;
        return card;
      }),
    })),
  };
}

function validate(topics) {
  const problems = [];
  const notes = [];
  for (const t of topics) {
    const markers = new Set();
    if (t.sub_topics.length === 0) problems.push(`주제 ${t.id}: 소주제 없음`);
    for (const s of t.sub_topics) {
      if (markers.has(s.marker))
        problems.push(`주제 ${t.id}: marker 중복 ${s.marker}`);
      markers.add(s.marker);
      const numbers = new Set();
      for (const c of s.cards) {
        const at = `주제 ${t.id}-${s.marker}-${c.number} "${c.title}"`;
        if (numbers.has(c.number))
          problems.push(`주제 ${t.id}-${s.marker}: card number 중복 ${c.number}`);
        numbers.add(c.number);
        if (!c.title) problems.push(`${at}: 제목 없음`);
        if (!c.badge.code) problems.push(`${at}: 배지 코드 없음`);
        if (!c.label) problems.push(`${at}: 상단라벨 없음`);
        // 메타 괄호줄이 본문으로 새어 들어간 경우(파서가 놓친 서식) 잡아낸다.
        if (/배지\s*[:：]?\s*\d|상단라벨\s*[:：]/.test(c.body))
          problems.push(`${at}: 본문에 메타 정보가 섞임 — "${c.body.slice(0, 50)}"`);
        if (!c.body && c.comparison_tables.length === 0)
          problems.push(`${at}: 본문·표 모두 없음`);
        // 아래 둘은 원문 자체가 그런 구성인 경우가 있어 참고용으로만 보고한다.
        if (!c.body) notes.push(`${at}: 본문 없이 표만 있는 카드`);
        if (c.key_points.length === 0 && c.comparison_tables.length === 0)
          notes.push(`${at}: 핵심정리·표 없이 본문만 있는 카드`);
      }
    }
  }
  return { problems, notes };
}

/** 현행 JSON과 카드 제목을 대조해 추가/삭제 목록을 만든다. */
function diffAgainstCurrent(topics) {
  const report = [];
  for (const t of topics) {
    let current;
    try {
      current = JSON.parse(readFileSync(join(OUT_DIR, `${t.id}.json`), "utf8"));
    } catch {
      report.push(`주제 ${t.id}: 현행 JSON 없음(신규)`);
      continue;
    }
    const flat = (topic) =>
      topic.sub_topics.flatMap((s) => s.cards.map((c) => `${s.title} ▸ ${c.title}`));
    const before = flat(current);
    const after = flat(t);
    const removed = before.filter((x) => !after.includes(x));
    const added = after.filter((x) => !before.includes(x));
    report.push(
      `주제 ${t.id} ${t.title} — 카드 ${before.length} → ${after.length}` +
        (current.title !== t.title
          ? ` / 제목 변경: "${current.title}" → "${t.title}"`
          : ""),
    );
    for (const x of removed) report.push(`   - ${x}`);
    for (const x of added) report.push(`   + ${x}`);
  }
  return report;
}

const write = process.argv.includes("--write");
const { topics, issues } = parse(readFileSync(SOURCE, "utf8"));
const { problems, notes } = validate(topics);

console.log("=== 변환 결과 ===");
for (const t of topics) {
  const cards = t.sub_topics.reduce((n, s) => n + s.cards.length, 0);
  const tables = t.sub_topics.reduce(
    (n, s) => n + s.cards.reduce((m, c) => m + c.comparison_tables.length, 0),
    0,
  );
  const points = t.sub_topics.reduce(
    (n, s) => n + s.cards.reduce((m, c) => m + c.key_points.length, 0),
    0,
  );
  console.log(
    `${String(t.id).padStart(2)} ${t.title} — 소주제 ${t.sub_topics.length} / 카드 ${cards} / 표 ${tables} / 핵심정리 ${points}`,
  );
}
const totalCards = topics.reduce(
  (n, t) => n + t.sub_topics.reduce((m, s) => m + s.cards.length, 0),
  0,
);
console.log(`합계: 주제 ${topics.length} / 카드 ${totalCards}`);

console.log(`\n=== 파싱 경고 (${issues.length}) ===`);
issues.forEach((x) => console.log(" ", x));
console.log(`\n=== 스키마 점검 (${problems.length}) ===`);
problems.forEach((x) => console.log(" ", x));
console.log(`\n=== 참고 (${notes.length}) ===`);
notes.forEach((x) => console.log(" ", x));
console.log("\n=== 현행 대비 변경 ===");
diffAgainstCurrent(topics).forEach((x) => console.log(x));

if (write) {
  const stringify = (value) =>
    JSON.stringify(value, null, 2).replace(/\n/g, "\r\n");
  for (const t of topics)
    writeFileSync(join(OUT_DIR, `${t.id}.json`), stringify(toJson(t)), "utf8");
  writeFileSync(
    join(OUT_DIR, "index.json"),
    stringify(topics.map((t) => ({ id: t.id, title: t.title }))),
    "utf8",
  );
  console.log(`\n기록 완료: ${OUT_DIR} (${topics.length + 1}개 파일)`);
} else {
  console.log("\n(드라이런 — 기록하려면 --write)");
}
