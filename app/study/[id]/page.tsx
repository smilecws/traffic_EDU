"use client";

import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/shared/Button";
import { StudyCard } from "@/components/study/StudyCard";
import { useStudyTopic } from "@/lib/hooks/useStudy";

export default function StudyDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: topic, isLoading } = useStudyTopic(id);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      </main>
    );
  }

  // not-found — 잘못된 id 또는 로드 실패(topic === null)
  if (!topic) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-6">
        <PageHeader title="학습하기" />
        <div className="space-y-4 py-10 text-center">
          <p className="text-sm text-slate-400">
            해당 학습 주제를 찾을 수 없습니다.
          </p>
          <Button onClick={() => router.push("/study")}>
            학습하기로 돌아가기
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-6">
      <PageHeader title={topic.title} />

      {topic.sub_topics.map((sub) => (
        <section key={sub.marker} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f4fb] text-sm font-semibold text-violet-600">
              {sub.marker}
            </span>
            <h2 className="text-lg font-semibold text-slate-900">{sub.title}</h2>
          </div>
          <div className="space-y-3">
            {sub.cards.map((card) => (
              <StudyCard key={card.number} card={card} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
