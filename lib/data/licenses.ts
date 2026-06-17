import type { LucideIcon } from "lucide-react";
import { Car, CarFront, Forklift, Truck } from "lucide-react";
import type { TileColor } from "@/components/shared/IconTile";

/** 모의고사 면허 종류 (quiz.png 바텀시트와 일치). */
export interface LicenseType {
  id: string; // url-safe ascii (query param에 사용)
  label: string; // 표시명
  passScore: number; // 합격 기준 점수
  color: TileColor;
  icon: LucideIcon; // lucide 아이콘 컴포넌트 참조 (JSX 아님)
}

/** 모의고사 제한 시간 (40분). */
export const MOCK_DURATION_MS = 40 * 60 * 1000;

export const LICENSE_TYPES: LicenseType[] = [
  { id: "type1-large", label: "1종 대형", passScore: 70, color: "blue", icon: Truck },
  { id: "type1-special", label: "1종 특수", passScore: 70, color: "violet", icon: Forklift },
  { id: "type1-normal", label: "1종 보통", passScore: 70, color: "green", icon: Car },
  { id: "type2-normal", label: "2종 보통", passScore: 60, color: "amber", icon: CarFront },
];

/** id로 면허 종류를 조회한다. 없으면 undefined. */
export function getLicense(id: string): LicenseType | undefined {
  return LICENSE_TYPES.find((l) => l.id === id);
}
