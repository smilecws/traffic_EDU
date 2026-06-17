import type { Choice, Question } from "@/lib/types";

/** 원본 JSON(public/data/questions_kor.json) 스키마 — snake_case 유지. */
interface RawQuestion {
  question_number: number;
  question: string;
  choices: Record<string, string>;
  answers: number[];
  explanation: string;
  image: string[] | null;
  image_explanation: string[] | null;
  explanation_image: string[] | null;
  video: string | null;
}

/** 원본 상대경로(questions_images/...)를 public 서빙 경로(/...)로 변환. */
function toPublicPath(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

/** 문제번호(문자열) → 유형 맵 (public/data/question_types.json). */
type QuestionTypeMap = Record<string, string>;

/** 원본 한 건을 앱 도메인 타입(Question)으로 정규화한다. */
function normalize(raw: RawQuestion, types: QuestionTypeMap): Question {
  const choices: Choice[] = Object.entries(raw.choices)
    .map(([key, text]) => ({ id: Number(key), text }))
    .sort((a, b) => a.id - b.id);

  return {
    id: String(raw.question_number),
    number: raw.question_number,
    type: types[String(raw.question_number)],
    question: raw.question,
    choices,
    answerIds: raw.answers,
    explanation: raw.explanation,
    images: raw.image?.map(toPublicPath),
    imageNotes: raw.image_explanation ?? undefined,
    explanationImages: raw.explanation_image?.map(toPublicPath),
    video: raw.video ? toPublicPath(raw.video) : undefined,
  };
}

/**
 * 정적 문제 데이터(questions_kor.json)와 유형 맵(question_types.json)을
 * 함께 로드해 정규화한다. 유형 파일은 보조 데이터이므로 실패해도 본문은 로드한다.
 */
export async function loadQuestions(): Promise<Question[]> {
  const [questionsRes, typesRes] = await Promise.all([
    fetch("/data/questions_kor.json"),
    fetch("/data/question_types.json"),
  ]);

  if (!questionsRes.ok) {
    throw new Error(`문제 데이터 로드 실패: ${questionsRes.status}`);
  }

  const raw = (await questionsRes.json()) as RawQuestion[];
  // 유형 파일은 best-effort — 없거나 실패하면 유형 없이 진행.
  const types: QuestionTypeMap = typesRes.ok ? await typesRes.json() : {};

  return raw.map((q) => normalize(q, types));
}
