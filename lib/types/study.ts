// 학습 콘텐츠 타입 정의 — 원본 JSON(public/data/study) 스키마와 정확히 일치(snake_case 유지)

export interface ComparisonTable {
  headers: string[];
  rows: string[][];
}

/** 카드 뱃지 — code는 자유 태그(법/처벌/개념/RULE/PENALTY 등) */
export interface StudyBadge {
  number: number;
  code: string;
}

export interface StudyCard {
  number: number;
  title: string;
  badge: StudyBadge;
  label: string;
  body: string;
  key_points: string[];
  comparison_tables: ComparisonTable[];
  subtitle?: string;
}

export interface StudySubTopic {
  marker: string;
  title: string;
  cards: StudyCard[];
}

export interface StudyTopic {
  id: number;
  title: string;
  sub_topics: StudySubTopic[];
}

/** 리스트 화면용 경량 목록(public/data/study/index.json) */
export interface StudyTopicSummary {
  id: number;
  title: string;
}
