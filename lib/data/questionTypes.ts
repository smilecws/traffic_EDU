/**
 * 문제 유형 — value는 public/data/question_types.json의 값과 **정확히 일치**해야 한다.
 * (필터링 시 q.type === value 로 비교하므로 오타 시 매칭 실패)
 */
export interface QuestionTypeOption {
  value: string;
  /** 화면 표시용 짧은 라벨 */
  label: string;
}

export const QUESTION_TYPES: QuestionTypeOption[] = [
  { value: "도로교통법규 문제", label: "도로교통법규" },
  { value: "사진 및 상황 문제", label: "사진 및 상황" },
  { value: "동영상문제", label: "동영상" },
];
