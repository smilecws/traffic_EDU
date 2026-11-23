import type { Question } from "@/lib/types";
import { QUESTION_TYPES } from "@/lib/data/questionTypes";

/**
 * 문항 분류기 — 그룹 오답률을 "어떤 묶음"으로 볼지 결정한다.
 *
 * 지금은 question_types.json 기반 3분류(법규/사진·상황/동영상)뿐이다.
 * 추후 학습자료의 16개 주제(public/data/study/index.json)로 올리려면
 * 문항→주제 매핑 파일을 읽는 Classifier를 하나 더 추가해 CLASSIFIERS에 등록하면 된다.
 * 집계·화면 코드는 Classifier 인터페이스만 보므로 수정이 필요 없다.
 */

/** 분류 결과 한 칸. */
export interface Bucket {
  key: string;
  label: string;
}

export interface Classifier {
  id: string;
  /** 화면에 표시할 분류 기준 이름 */
  label: string;
  /** 문항이 속한 묶음. 판단 불가 시 UNCLASSIFIED를 반환한다. */
  classify(question: Question): Bucket;
  /** 결과가 0건이어도 표에 남길 기본 묶음 순서 */
  buckets(): Bucket[];
}

/** 유형 정보가 없는 문항이 모이는 묶음. */
export const UNCLASSIFIED: Bucket = { key: "__none__", label: "미분류" };

/** 문제 유형(3분류) 기준 분류기. */
export const TYPE_CLASSIFIER: Classifier = {
  id: "type",
  label: "문제 유형(3분류)",
  classify(question) {
    const type = question.type;
    if (!type) return UNCLASSIFIED;
    const option = QUESTION_TYPES.find((t) => t.value === type);
    return { key: type, label: option?.label ?? type };
  },
  buckets() {
    return QUESTION_TYPES.map((t) => ({ key: t.value, label: t.label }));
  },
};

/** 사용 가능한 분류기 목록. 새 기준을 추가하면 여기에 등록한다. */
export const CLASSIFIERS: Classifier[] = [TYPE_CLASSIFIER];

/** 기본 분류기. */
export const DEFAULT_CLASSIFIER = TYPE_CLASSIFIER;
