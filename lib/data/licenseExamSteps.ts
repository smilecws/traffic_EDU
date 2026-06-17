export interface LicenseExamStep {
  step: number; // 1..7
  title: string;
  description: string;
  prepare?: string[]; // 준비물
  note?: string; // 예외/재응시 등 비고
}

/** 출처: 한국도로교통공단 안전운전 통합민원 — 운전면허 취득 7단계 절차 */
export const LICENSE_EXAM_STEPS: LicenseExamStep[] = [
  {
    step: 1,
    title: "응시 전 교통안전교육",
    description: "학과시험 전까지 교통안전교육 이수를 완료해야 합니다.",
    prepare: ["신분증"],
  },
  {
    step: 2,
    title: "신체검사",
    description: "시험장 내 신체검사실 또는 병원에서 신체검사를 진행합니다.",
    note: "문경·강릉·태백·광양·충주·춘천 시험장은 신체검사실이 없습니다.",
  },
  {
    step: 3,
    title: "학과시험",
    description: "교통법규 등 학과시험에 응시합니다.",
    prepare: [
      "응시원서",
      "신분증",
      "6개월 이내 촬영한 컬러 사진(3.5×4.5cm) 3매",
    ],
  },
  {
    step: 4,
    title: "기능시험",
    description: "시험장 내에서 장내기능시험에 응시합니다.",
    prepare: ["응시원서", "신분증"],
    note: "대리접수 시 대리인 신분증과 위임자의 위임장이 필요합니다. 불합격 시 불합격일로부터 3일이 지난 후 재응시할 수 있습니다.",
  },
  {
    step: 5,
    title: "연습면허 발급",
    description:
      "제1·2종 보통면허 응시자 중 학과시험과 장내기능시험에 모두 합격한 사람에게 발급됩니다.",
    prepare: ["응시원서", "신분증"],
  },
  {
    step: 6,
    title: "도로주행시험",
    description: "연습면허로 도로주행시험에 응시합니다(제1·2종 보통면허 대상).",
    prepare: ["응시원서", "신분증"],
    note: "불합격 시 불합격일로부터 3일이 지난 후 재응시할 수 있습니다.",
  },
  {
    step: 7,
    title: "운전면허증 발급",
    description:
      "제1·2종 보통면허는 연습면허 취득 후 도로주행시험에 합격하면, 그 밖의 면허는 학과시험과 장내기능시험에 합격하면 운전면허증이 발급됩니다.",
    prepare: ["응시원서", "신분증"],
  },
];

export const LICENSE_EXAM_SOURCE = {
  label: "안전운전 통합민원",
  subtitle: "한국도로교통공단 · 원문 보기",
  url: "https://www.safedriving.or.kr/dtGuide/selectDtGuide01.do",
};
