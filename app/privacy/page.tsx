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
            수집된 익명 기록은 문제별 시도 수·오답 수 집계에만 사용합니다.
          </li>
        </ul>
      </section>

      {/* 4. 처리위탁 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          4. 인프라 운영
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          익명 통계 저장 및 서비스 호스팅에 Google LLC(Firebase / Firestore),
          Vercel Inc.의 인프라를 이용합니다. 위 사업자에 전달되는 데이터에는 개인
          식별 정보가 포함되지 않습니다.
        </p>
      </section>

      {/* 5. 문의처 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">5. 문의처</h2>
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

      {/* 6. 변경 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          6. 처리방침의 변경
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          본 방침은 법령 및 서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스
          내 공지를 통해 알립니다.
        </p>
      </section>
    </main>
  );
}
