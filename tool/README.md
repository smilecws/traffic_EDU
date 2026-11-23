# 집계 도구 (aggregate)

`wrong_answer_logs`(Firestore, 익명) 전체를 읽어 **questionId별 오답 횟수**를 세고
**Top 50**을 뽑아 repo 루트의 `aggregates.json`으로 출력하는 독립 Node 도구입니다.
Next 앱과 분리되어 있으며, GitHub Action이 예약 실행합니다.

## 로컬 실행

```bash
cd tool
npm install
FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" npm run aggregate
```

- `key.json`은 Firebase 서비스 계정 키입니다.
- 인증은 환경변수 `FIREBASE_SERVICE_ACCOUNT`(서비스 계정 JSON 문자열)로만 합니다.

## 출력 (`aggregates.json`)

```json
{
  "updatedAt": "<ISO8601>",
  "totalWrongLogs": 1234,
  "top": [{ "questionId": "<id>", "wrongCount": 42 }]
}
```

- 출력에는 **questionId·wrongCount만** 담깁니다. `selectedIds`·`createdAt` 등
  원시 로그나 개인 식별 정보는 출력하지 않습니다.

## 보안

- **서비스 계정 키(`key.json`)는 절대 커밋하지 마세요.** 환경변수로만 주입합니다.
- `tool/key.json`, `tool/node_modules`는 `.gitignore`에 등록되어 있습니다.

---

# 관리자 화면(/admin) 설정

회차별 통계 화면은 **공유 비밀번호 1개**로 들어갑니다. 비밀번호 검증과 Firestore
읽기는 모두 서버 라우트(`app/api/admin/`)에서 하므로, 브라우저에는 비밀번호도
서비스 계정 키도 내려가지 않습니다. Firestore 보안 규칙은 읽기를 계속 전면
차단한 상태로 둡니다.

## 필요한 환경변수 (Vercel → Settings → Environment Variables)

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 관리자 비밀번호 | 8자 이상 권장. `NEXT_PUBLIC_` 붙이지 말 것 |
| `FIREBASE_SERVICE_ACCOUNT` | 서비스 계정 JSON **전문** | 집계 workflow와 같은 값 |

- 두 값 모두 **서버 전용**입니다. `NEXT_PUBLIC_` 접두사를 붙이면 브라우저에
  노출되므로 절대 붙이지 마세요.
- 설정 후 **재배포**해야 반영됩니다.
- 비밀번호를 바꾸면 기존 세션(12시간 쿠키)은 전부 무효화됩니다.
- 로컬 개발은 `.env.local`에 같은 두 값을 넣으면 됩니다(커밋 금지).

## 색인

회차 조회는 `g` + `createdAt` 복합 색인을 씁니다.

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

# 학습자료 변환 (카드뉴스 HWP → study JSON)

학습하기 탭의 원천 데이터(`public/data/study/*.json`)는 **카드뉴스 HWP 검토본**에서
생성합니다. 의존성 없이 Node만으로 돌아갑니다.

```bash
# 1) HWP(한글 5.0) → 평문 원문. 원문은 저장소에 커밋해 다음 개정본과 diff한다.
node tool/hwp-to-text.mjs "<카드뉴스.hwp>" tool/source/cardnews.md

# 2) 원문 → JSON. 먼저 드라이런으로 리포트만 확인하고,
node tool/cardnews-to-study.mjs
#    이상이 없으면 기록한다(public/data/study/1~16.json, index.json).
node tool/cardnews-to-study.mjs --write
```

## 변환 규칙

| 원문 | JSON |
| --- | --- |
| `대주제: …` | 파일 1개(`{id}.json`) + `index.json` 항목 |
| `소주제 A/1: …` | `sub_topics[]` — marker는 등장 순서대로 A, B, C 재부여 |
| `카드 N: 제목 (배지: 01 · 법 / 상단라벨: … / 부제: …)` | `cards[]`의 title·badge·label·subtitle |
| `[본문]` | `body` |
| `[핵심정리]` 불릿 | `key_points[]` |
| 마크다운 표, `[표/비교정리]` | `comparison_tables[]` |

- `<br>`·`**굵게**`·머리말 `#`은 제거합니다(렌더러가 평문만 출력).
- 구분행(`| :--- |`)이 다시 나오면 **새 표**로 끊습니다(원문에 표 두 개가 맞붙은 곳이 있음).
- 헤더가 전부 같은 표(`| 항목 | 항목 |`)는 비교표가 아니라 2단 목록이므로 `key_points`로 폅니다.

## 리포트

드라이런·기록 모두 아래를 출력하므로 반영 전에 확인하세요.

- 주제별 소주제/카드/표/핵심정리 개수
- **파싱 경고** — 표 열 수 불일치, 알 수 없는 섹션 마커 등
- **스키마 점검** — 빈 제목·배지·라벨, 본문에 메타가 섞인 카드, 중복 marker/number
- **현행 대비 변경** — 현재 `public/data/study`와 대조한 카드 추가(+)/삭제(-) 목록
