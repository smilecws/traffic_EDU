#!/usr/bin/env node
/**
 * HWP(한글 5.0) → 평문 텍스트 추출기 (의존성 없음)
 *
 *   node tool/hwp-to-text.mjs <input.hwp> [output.md]
 *
 * HWP 5.0 파일은 OLE2(CFB) 컨테이너다. FileHeader로 압축 여부를 확인하고
 * BodyText/SectionN 스트림을 raw-inflate 한 뒤, 레코드 중 PARA_TEXT(tag 67)의
 * UTF-16LE 문자열만 모아 문단 단위로 출력한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const CFB_SIGNATURE = "d0cf11e0a1b11ae1";
const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const HWPTAG_PARA_TEXT = 67;

/** OLE2(CFB) 컨테이너를 파싱해 { name → Buffer } 맵을 만든다. */
function readCompoundFile(buf) {
  if (buf.subarray(0, 8).toString("hex") !== CFB_SIGNATURE) {
    throw new Error("OLE2(CFB) 시그니처가 아닙니다 — HWP 5.0 파일이 맞는지 확인하세요.");
  }
  const sectorSize = 1 << buf.readUInt16LE(30);
  const miniSectorSize = 1 << buf.readUInt16LE(32);
  const numFatSectors = buf.readUInt32LE(44);
  const firstDirSector = buf.readUInt32LE(48);
  const miniCutoff = buf.readUInt32LE(56);
  const firstMiniFatSector = buf.readUInt32LE(60);
  const firstDifatSector = buf.readUInt32LE(68);
  const numDifatSectors = buf.readUInt32LE(72);

  const sector = (n) => {
    const start = (n + 1) * sectorSize;
    if (start + sectorSize > buf.length) throw new Error(`섹터 ${n} 범위 초과`);
    return buf.subarray(start, start + sectorSize);
  };

  // DIFAT: 헤더 내 109개 + 추가 DIFAT 섹터 체인
  const difat = [];
  for (let i = 0; i < 109; i++) {
    const s = buf.readUInt32LE(76 + i * 4);
    if (s !== FREESECT) difat.push(s);
  }
  let next = firstDifatSector;
  for (let i = 0; i < numDifatSectors && next !== ENDOFCHAIN && next !== FREESECT; i++) {
    const sec = sector(next);
    const perSector = sectorSize / 4 - 1;
    for (let j = 0; j < perSector; j++) {
      const s = sec.readUInt32LE(j * 4);
      if (s !== FREESECT) difat.push(s);
    }
    next = sec.readUInt32LE(perSector * 4);
  }

  // FAT
  const fat = [];
  for (const s of difat.slice(0, numFatSectors || difat.length)) {
    const sec = sector(s);
    for (let j = 0; j < sectorSize / 4; j++) fat.push(sec.readUInt32LE(j * 4));
  }

  const chain = (start, fatTable) => {
    const out = [];
    let cur = start;
    const seen = new Set();
    while (cur !== ENDOFCHAIN && cur !== FREESECT && cur < fatTable.length) {
      if (seen.has(cur)) throw new Error("섹터 체인 순환 감지");
      seen.add(cur);
      out.push(cur);
      cur = fatTable[cur];
    }
    return out;
  };

  const readChain = (start, size, fatTable, readSector, unit) => {
    const parts = chain(start, fatTable).map(readSector);
    return Buffer.concat(parts).subarray(0, size ?? parts.length * unit);
  };

  // 디렉터리 엔트리
  const dirBuf = readChain(firstDirSector, null, fat, sector, sectorSize);
  const entries = [];
  for (let off = 0; off + 128 <= dirBuf.length; off += 128) {
    const nameLen = dirBuf.readUInt16LE(off + 64);
    const type = dirBuf.readUInt8(off + 66);
    if (type === 0) continue; // unallocated
    const name = dirBuf
      .subarray(off, off + Math.max(0, nameLen - 2))
      .toString("ucs2");
    entries.push({
      name,
      type, // 1 storage, 2 stream, 5 root
      start: dirBuf.readUInt32LE(off + 116),
      size: Number(dirBuf.readBigUInt64LE(off + 120)),
    });
  }

  // 미니 FAT + 미니 스트림(루트 엔트리의 스트림)
  const root = entries.find((e) => e.type === 5);
  const miniFat = [];
  if (firstMiniFatSector !== ENDOFCHAIN) {
    const mfBuf = readChain(firstMiniFatSector, null, fat, sector, sectorSize);
    for (let j = 0; (j + 1) * 4 <= mfBuf.length; j++) miniFat.push(mfBuf.readUInt32LE(j * 4));
  }
  const miniStream = root && root.size > 0
    ? readChain(root.start, root.size, fat, sector, sectorSize)
    : Buffer.alloc(0);
  const miniSector = (n) => miniStream.subarray(n * miniSectorSize, (n + 1) * miniSectorSize);

  const streams = new Map();
  for (const e of entries) {
    if (e.type !== 2) continue;
    const data = e.size < miniCutoff
      ? readChain(e.start, e.size, miniFat, miniSector, miniSectorSize)
      : readChain(e.start, e.size, fat, sector, sectorSize);
    streams.set(e.name, data);
  }
  return streams;
}

/** HWP 레코드 스트림을 순회하며 PARA_TEXT 문단 텍스트를 뽑는다. */
function extractParagraphs(data) {
  // 제어문자 분류: 확장/인라인 제어문자는 8 WCHAR(16바이트)를 차지한다.
  const EXTENDED = new Set([1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23]);
  const INLINE = new Set([4, 5, 6, 7, 8, 9, 19, 20]);
  const paragraphs = [];
  let i = 0;
  while (i + 4 <= data.length) {
    const header = data.readUInt32LE(i);
    const tag = header & 0x3ff;
    let size = (header >> 20) & 0xfff;
    i += 4;
    if (size === 0xfff) {
      size = data.readUInt32LE(i);
      i += 4;
    }
    if (i + size > data.length) break;
    if (tag === HWPTAG_PARA_TEXT) {
      let s = "";
      for (let j = 0; j + 2 <= size; ) {
        const ch = data.readUInt16LE(i + j);
        if (ch === 10 || ch === 13) {
          s += "\n";
          j += 2;
        } else if (ch === 0) {
          j += 2;
        } else if (ch < 32) {
          j += EXTENDED.has(ch) || INLINE.has(ch) ? 16 : 2;
        } else {
          s += String.fromCharCode(ch);
          j += 2;
        }
      }
      paragraphs.push(s);
    }
    i += size;
  }
  return paragraphs;
}

export function hwpToText(filePath) {
  const streams = readCompoundFile(readFileSync(filePath));
  const fileHeader = streams.get("FileHeader");
  if (!fileHeader) throw new Error("FileHeader 스트림이 없습니다 — HWP 5.0 파일이 아닙니다.");
  const compressed = (fileHeader[36] & 0x01) !== 0;

  const sections = [...streams.keys()]
    .filter((n) => /^Section\d+$/.test(n))
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));
  if (sections.length === 0) throw new Error("BodyText 섹션 스트림을 찾지 못했습니다.");

  const paragraphs = [];
  for (const name of sections) {
    let data = streams.get(name);
    if (compressed) data = inflateRawSync(data);
    paragraphs.push(...extractParagraphs(data));
  }
  return paragraphs.join("\n");
}

const [, , input, output] = process.argv;
if (!input) {
  console.error("사용법: node tool/hwp-to-text.mjs <input.hwp> [output.md]");
  process.exit(1);
}
const text = hwpToText(input);
if (output) {
  writeFileSync(output, text, "utf8");
  console.error(`추출 완료: ${output} (${text.length.toLocaleString()}자)`);
} else {
  process.stdout.write(text);
}
