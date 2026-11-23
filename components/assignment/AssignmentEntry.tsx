"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardList } from "lucide-react";
import {
  getAssignmentStateServerSnapshot,
  getAssignmentStateSnapshot,
  subscribeAssignmentState,
} from "@/lib/services/assignmentService";
import { IconTile } from "@/components/shared/IconTile";

const iconProps = { size: 24, strokeWidth: 1.5 } as const;

/**
 * 홈 화면의 "이번 교육 문제" 입구.
 *
 * 교수자가 문제를 지정한 회차 QR로 들어온 기기에서만 나타난다. 그 밖에는
 * null — 일반 사용자의 홈 화면은 전과 완전히 같다(설문 입구와 같은 규칙).
 *
 * 다른 메뉴를 숨기지 않는다. 숨겨도 강제력이 없고(문제 데이터는 공개되어
 * 있다) 교육이 끝난 뒤 앱이 반쪽처럼 보이게 된다. 대신 홈 맨 위에 둬서
 * 교육생이 먼저 누르게 한다.
 */
export function AssignmentEntry() {
  const router = useRouter();
  const { code, count } = useSyncExternalStore(
    subscribeAssignmentState,
    getAssignmentStateSnapshot,
    getAssignmentStateServerSnapshot,
  );

  if (!code || count === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => router.push("/quiz/play?mode=assigned")}
        className="flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left transition-shadow hover:shadow-md"
      >
        <IconTile color="violet">
          <ClipboardList {...iconProps} />
        </IconTile>
        <div className="flex-1">
          <p className="text-base font-semibold text-slate-900">
            이번 교육 문제
          </p>
          <p className="text-xs text-slate-500">
            {count}문제 · 교수자가 지정한 문제입니다
          </p>
        </div>
        <ChevronRight size={20} strokeWidth={1.5} className="text-violet-400" />
      </button>
    </section>
  );
}
