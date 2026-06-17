"use client";

import { CreditCard, FileText, Globe, Users, Info } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExternalLinkRow } from "@/components/shared/ExternalLinkRow";

const SOURCE_URL = "https://www.safedriving.or.kr/dtGuide/selectDtGuide17.do";

interface PrepSection {
  title: string;
  /** 수수료 */
  fee: string;
  /** 준비물(지참물) */
  items: string;
  /** 인터넷 접수 가능 여부 */
  online: string;
  /** 대리접수 가능 여부 */
  proxy: string;
  /** 주의사항(선택) */
  note?: string;
}

/** 출처: 한국도로교통공단 안전운전 통합민원 — 면허시험 준비물 가이드 */
const SECTIONS: PrepSection[] = [
  {
    title: "신규 응시 신체검사",
    fee: "1종 대형·특수 7,000원 / 기타 면허 6,000원",
    items: "신분증, 6개월 이내 컬러 사진(3.5×4.5cm) 3매",
    online: "불가",
    proxy: "불가 (본인 신체검사)",
    note: "병원 신체검사 외 건강검진결과·징병신체검사서 활용 가능. 강릉·태백·문경·광양·충주·춘천 시험장에는 신체검사장이 없음. 단안시력자는 안과의사 진단서 필요.",
  },
  {
    title: "학과 시험 (재응시 포함)",
    fee: "10,000원 (원동기 8,000원)",
    items: "신분증, 응시원서",
    online: "예약 가능",
    proxy: "불가",
  },
  {
    title: "기능 시험 (재응시 포함)",
    fee: "대형·특수 25,000원 / 1·2종 보통 25,000원 / 2종 소형 14,000원 / 원동기 10,000원",
    items: "신분증, 응시원서",
    online: "가능",
    proxy: "가능 (위임장, 대리인·위임자 신분증, 응시원서)",
  },
  {
    title: "도로주행 시험 (재응시 포함)",
    fee: "30,000원",
    items: "신분증, 응시원서",
    online: "가능",
    proxy: "가능 (위임장, 대리인·위임자 신분증, 응시원서)",
  },
  {
    title: "합격자 면허증 교부",
    fee: "운전면허증(국문/영문) 10,000원 / 모바일 운전면허증 15,000원",
    items: "신분증, 응시원서, 6개월 이내 컬러 사진(3.5×4.5cm) 1매",
    online: "불가",
    proxy: "가능 (단, 수령은 본인만 가능)",
    note: "기존 면허증 소지자는 구 면허증을 반납해야 함.",
  },
  {
    title: "연습면허 / 연습면허 재교부",
    fee: "4,000원",
    items: "신분증, 응시원서",
    online: "가능 (재교부는 불가)",
    proxy: "가능 (위임장, 대리인·위임자 신분증, 응시원서)",
  },
  {
    title: "응시원서 분실",
    fee: "1,000원 (연습면허 재발급 시 4,000원)",
    items: "신분증, 6개월 이내 컬러 사진(3.5×4.5cm) 1매",
    online: "불가",
    proxy: "가능 (위임장, 대리인·위임자 신분증)",
  },
];

const iconProps = { size: 16, strokeWidth: 1.5 } as const;

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="flex-1">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-sm text-slate-700 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

export default function PrepGuidePage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
      <PageHeader title="준비물 가이드" />

      <p className="text-sm text-slate-500 leading-relaxed">
        운전면허 시험·발급 단계별로 챙겨야 할 지참물과 수수료, 접수 방법을
        정리했습니다.
      </p>

      <section className="space-y-3">
        {SECTIONS.map((s) => (
          <article
            key={s.title}
            className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3"
          >
            <h2 className="text-base font-semibold text-slate-900">{s.title}</h2>
            <div className="space-y-2.5">
              <InfoRow
                icon={<FileText {...iconProps} />}
                label="준비물"
                value={s.items}
              />
              <InfoRow
                icon={<CreditCard {...iconProps} />}
                label="수수료"
                value={s.fee}
              />
              <InfoRow
                icon={<Globe {...iconProps} />}
                label="인터넷 접수"
                value={s.online}
              />
              <InfoRow
                icon={<Users {...iconProps} />}
                label="대리접수"
                value={s.proxy}
              />
            </div>
            {s.note && (
              <div className="rounded-lg bg-[#f5f4fb] border border-[#ebe9f5] p-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {s.note}
                </p>
              </div>
            )}
          </article>
        ))}
      </section>

      {/* 기타 정보 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm">
        <div className="flex gap-2.5">
          <Info size={16} strokeWidth={1.5} className="mt-0.5 text-slate-400" />
          <div className="space-y-1 text-sm text-slate-700 leading-relaxed">
            <p>고객센터: 1577-1120 (수화상담 107)</p>
            <p className="text-slate-500">담당: 한국도로교통공단 면허시험처</p>
          </div>
        </div>
      </section>

      {/* 출처 */}
      <section className="space-y-2">
        <p className="text-xs font-medium text-slate-400">출처</p>
        <ExternalLinkRow
          icon={<Globe size={24} strokeWidth={1.5} />}
          color="blue"
          title="안전운전 통합민원"
          subtitle="한국도로교통공단 · 원문 보기"
          href={SOURCE_URL}
        />
      </section>
    </main>
  );
}
