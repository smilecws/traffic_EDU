import type { StudyTopic, StudyTopicSummary } from "@/lib/types/study";

/** 학습 토픽 목록(public/data/study/index.json)을 로드한다. */
export async function loadStudyIndex(): Promise<StudyTopicSummary[]> {
  const res = await fetch("/data/study/index.json");
  if (!res.ok) {
    throw new Error(`학습 목록 로드 실패: ${res.status}`);
  }
  return (await res.json()) as StudyTopicSummary[];
}

/** 학습 토픽 상세(public/data/study/{id}.json)를 로드한다. 실패/404 시 null. */
export async function loadStudyTopic(id: number): Promise<StudyTopic | null> {
  const res = await fetch(`/data/study/${id}.json`);
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as StudyTopic;
}
