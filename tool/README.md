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
