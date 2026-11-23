"use client";

import { PageHeader } from "@/components/shared/PageHeader";

/**
 * 개인정보처리방침 페이지.
 * 본 서비스는 개인정보를 수집하지 않는다. 학습 데이터는 기기 내 localStorage에만
 * 저장하고, 문제별 정·오답은 개인 식별 정보 없이 익명으로만 집계한다.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
      <PageHeader title="개인정보처리방침" />

      <p className="text-sm text-slate-500 leading-relaxed">
        본 서비스(이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 수집하지
        않습니다. 별도의 로그인·회원가입 절차가 없으며, 이름·이메일·전화번호 등
        어떠한 개인 식별 정보도 요구하거나 저장하지 않습니다.
      </p>

      {/* 1. 수집하지 않음 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          1. 수집하는 개인정보 항목
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          <strong>없음.</strong> 서비스는 이용자를 식별할 수 있는 어떠한
          개인정보도 수집하지 않습니다.
        </p>
      </section>

      {/* 2. 기기 내 저장 데이터 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          2. 기기 내 저장 데이터
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            학습 진도, 오답노트, 즐겨찾기 등{" "}
            <strong>
              개인 학습 데이터는 이용자 기기의 브라우저 localStorage에만 저장
            </strong>
            됩니다.
          </li>
          <li>
            이 데이터는 서버로 전송되거나 운영자가 수집·열람하지 않으며, 브라우저
            데이터를 삭제하면 함께 사라집니다.
          </li>
        </ul>
      </section>

      {/* 3. 익명 통계 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          3. 익명 학습 통계
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            서비스 품질 개선(문제별 오답률 분석)을 위해, 풀이 완료 시 각 문제의{" "}
            <strong>정답·오답 여부만</strong> 익명으로 서버에 기록합니다.
          </li>
          <li>
            이 기록에는 이용자 식별자(계정·기기 ID 등), 선택한 보기 내용, 접속
            정보가 포함되지 않으며, 개인을 식별하거나 특정 이용자의 기록을 추적할
            수 없습니다.
          </li>
          <li>
            단체 교육 과정에서 배포된 링크로 접속한 경우, 해당{" "}
            <strong>교육 회차 코드</strong>가 기록에 함께 저장됩니다. 이는
            개인이 아닌 <strong>회차(반) 단위 오답률 분석</strong>에만 쓰이는
            표시이며, 개인을 식별하는 정보가 아닙니다. 회차 표시는 당일 자정에
            자동 해제됩니다.
          </li>
          <li>
            수집된 익명 기록은 문제별·회차별 시도 수·오답 수 집계에만
            사용합니다.
          </li>
        </ul>
      </section>

      {/* 4. 만족도 조사 — 자유 서술을 받으므로 별도 항목으로 분리해 명시한다. */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          4. 교육 만족도 조사
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            단체 교육 과정에서 만족도 조사가 포함된 링크로 접속한 경우에 한해,
            교육 당일 만족도 조사에 참여하실 수 있습니다.{" "}
            <strong>참여 여부는 전적으로 선택</strong>이며, 참여하지 않아도
            서비스 이용에 제한이 없습니다.
          </li>
          <li>
            저장하는 항목은 <strong>교육 회차 코드, 문항별 점수(1~5),</strong>{" "}
            그리고 이용자가 직접 입력한 <strong>주관식 의견</strong>입니다.
            이름·연락처·계정·기기 식별자 등 개인을 식별할 수 있는 정보는 함께
            저장하지 않으며, 응답자를 특정하거나 추적할 수 없습니다.
          </li>
          <li>
            주관식 의견은 <strong>입력하신 내용이 그대로 저장</strong>되므로,
            이름·연락처 등 개인정보를 입력하지 마시기 바랍니다. 입력은 선택
            사항이며, 비워 두고 제출하실 수 있습니다.
          </li>
          <li>
            수집된 응답은 교육 품질 개선 목적의 회차 단위 집계·검토에만
            사용합니다.
          </li>
        </ul>
      </section>

      {/* 5. 처리위탁 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          5. 인프라 운영
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          익명 통계 저장 및 서비스 호스팅에 Google LLC(Firebase / Firestore),
          Vercel Inc.의 인프라를 이용합니다. 위 사업자에 전달되는 데이터에는 개인
          식별 정보가 포함되지 않습니다.
        </p>
      </section>

      {/* 6. 문의처 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">6. 문의처</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          개인정보 처리에 관한 문의:{" "}
          <a
            href="mailto:smilecws@gmail.com"
            className="font-medium text-violet-600 hover:text-violet-700"
          >
            smilecws@gmail.com
          </a>
        </p>
      </section>

      {/* 7. 변경 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          7. 처리방침의 변경
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          본 방침은 법령 및 서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스
          내 공지를 통해 알립니다.
        </p>
      </section>
    </main>
  );
}
