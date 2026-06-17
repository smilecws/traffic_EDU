// 도메인 타입 정의 — Quiz App (도로교통법 학습)

/** 문제의 선택지 */
export interface Choice {
  id: number;
  text: string;
}

/**
 * 문제 (정적 JSON: public/data/questions_kor.json)
 * 원본 스키마(question_number/choices객체/answers배열 등)는 questionsService에서
 * 이 형태로 정규화한다. 복수 정답·이미지·영상을 지원한다.
 */
export interface Question {
  id: string;
  /** 원본 문제 번호 (표시용) */
  number: number;
  /**
   * 문제 유형 — public/data/question_types.json(문제번호→유형)에서 주입.
   * 매핑에 없으면 undefined.
   */
  type?: string;
  question: string;
  choices: Choice[];
  /** 정답 선택지 id 목록 (복수 정답 가능) */
  answerIds: number[];
  explanation: string;
  /** 문제 이미지 서빙 경로(/questions_images/...) */
  images?: string[];
  /** 이미지/상황에 대한 보조 설명 텍스트 (원본 image_explanation) */
  imageNotes?: string[];
  /** 해설 이미지 서빙 경로 */
  explanationImages?: string[];
  /** 문제 영상 서빙 경로(/questions_videos/...) */
  video?: string;
}

/** 단일 문제 채점 결과 (복수 선택 지원) */
export interface QuestionResult {
  questionId: string;
  selectedIds: number[];
  correct: boolean;
}

/** 진행 중/완료된 퀴즈 세션 */
export interface QuizSession {
  id: string;
  questions: Question[];
  results: QuestionResult[];
  startedAt: number;
  finishedAt: number | null;
}

/** 세션 채점 결과 */
export interface SessionResult {
  id: string;
  total: number;
  correctCount: number;
  scorePercent: number;
  finishedAt: number;
}

/** 누적 학습 통계 (localStorage) */
export interface UserStats {
  totalSessions: number;
  totalAnswered: number;
  totalCorrect: number;
}

/** 오답노트 항목 (localStorage) */
export interface WrongNote {
  questionId: string;
  selectedIds: number[];
  addedAt: number;
}

/** 즐겨찾기 항목 (localStorage) */
export interface Favorite {
  questionId: string;
  addedAt: number;
}

/** 익명 오답 집계 로그 (Firestore — 개인 식별 정보 없음) */
export interface WrongAnswerLog {
  questionId: string;
  selectedIds: number[];
}

/** 익명 답안 로그 항목 (정/오답만, 개인정보·선택지 없음) */
export interface AnswerLogItem {
  q: string;
  c: boolean;
} // q=questionId, c=correct

/** 전체 통계: 오답률 높은 문제 1건 (익명 집계 — questionId·시도/오답·오답률만) */
export interface GlobalTopEntry {
  questionId: string;
  attempts: number;
  wrong: number;
  wrongRate: number; // 0..1
}

/**
 * 전체 사용자 오답 집계 (사전 집계 정적 JSON: aggregates.json).
 * 클라이언트는 Firestore를 직접 읽지 않고 이 형태만 fetch한다.
 */
export interface GlobalAggregate {
  updatedAt: string; // ISO8601
  totalSessions?: number;
  minAttempts?: number;
  top: GlobalTopEntry[]; // 최대 50
}

/** 퀴즈 모드 — 랜덤/오답/즐겨찾기/모의고사/순서대로(번호순) */
export type QuizMode =
  | "random"
  | "wrong"
  | "favorite"
  | "mock"
  | "sequential";

/** 세션의 모드/면허 메타 (결과 저장·합격판정·이력에 사용) */
export interface SessionMeta {
  mode: QuizMode;
  licenseId?: string; // mock일 때만
  passScore?: number; // mock일 때만 (합격 기준 점수)
  durationMs?: number; // mock일 때만 (제한 시간)
}
