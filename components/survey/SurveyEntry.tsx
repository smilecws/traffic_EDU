"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, ChevronRight, MessageSquareHeart } from "lucide-react";
import {
  getSurveyStateServerSnapshot,
  getSurveyStateSnapshot,
  subscribeSurveyState,
} from "@/lib/services/surveyService";
import { IconTile } from "@/components/shared/IconTile";

const iconProps = { size: 24, strokeWidth: 1.5 } as const;

const rowStyles =
  "flex w-full items-center gap-3 rounded-2xl border border-[#ebe9f5] bg-white p-4 text-left";

/**
 * 홈 화면의 만족도 조사 입구.
 *
 * 설문이 켜진 회차 QR로 들어온 기기에서만 나타난다. 그 밖에는 null —
 * 일반 사용자의 홈 화면은 전과 완전히 같다.
 *
 * 응답을 마친 뒤에는 **버튼을 지우지 않고** 비활성 상태로 남긴다. 사라지면
 * 응답한 사람은 "원래 없던 건가?" 하고 헷갈리고, 강사도 설문이 꺼진 건지
 * 응답이 된 건지 구분할 수 없다.
 */
export function SurveyEntry() {
  const router = useRouter();
  const { code, done } = useSyncExternalStore(
    subscribeSurveyState,
    getSurveyStateSnapshot,
    getSurveyStateServerSnapshot,
  );

  if (!code) return null;

  if (done) {
    return (
      <section aria-labelledby="survey-done-title">
        <div className={rowStyles}>
          <IconTile color="teal">
            <CircleCheck {...iconProps} />
          </IconTile>
          <div className="flex-1">
            <p
              id="survey-done-title"
              className="text-base font-semibold text-slate-500"
            >
              이미 조사에 응답하셨습니다
            </p>
            <p className="text-xs text-slate-400">참여해 주셔서 감사합니다</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => router.push("/survey")}
        className={`${rowStyles} transition-shadow hover:shadow-md`}
      >
        <IconTile color="rose">
          <MessageSquareHeart {...iconProps} />
        </IconTile>
        <div className="flex-1">
          <p className="text-base font-semibold text-slate-900">
            교육 만족도 조사
          </p>
          <p className="text-xs text-slate-500">
            세 문항 · 1분이면 끝납니다
          </p>
        </div>
        <ChevronRight size={20} strokeWidth={1.5} className="text-slate-400" />
      </button>
    </section>
  );
}
