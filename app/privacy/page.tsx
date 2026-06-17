"use client";

import { PageHeader } from "@/components/shared/PageHeader";

/**
 * 개인정보처리방침 페이지.
 * docs/PRIVACY.md 본문을 화면에 그대로 렌더한다.
 * placeholder(보관기간/담당자)는 본문 그대로 노출 — 운영자가 추후 채운다.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
      <PageHeader title="개인정보처리방침" />

      <p className="text-sm text-slate-500 leading-relaxed">
        본 서비스(이하 &ldquo;서비스&rdquo;)는 「개인정보 보호법」(PIPA)에 따라
        이용자의 개인정보를 다음과 같이 처리합니다.
      </p>

      {/* 1. 수집 항목 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          1. 수집하는 개인정보 항목
        </h2>
        <div className="overflow-hidden rounded-lg border border-[#ebe9f5]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f5f4fb] text-xs font-medium text-slate-400">
              <tr>
                <th className="px-3 py-2">항목</th>
                <th className="px-3 py-2">필수 여부</th>
                <th className="px-3 py-2">비고</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-t border-[#ebe9f5]">
                <td className="px-3 py-2 font-medium">이름(닉네임 가능)</td>
                <td className="px-3 py-2">동의 시 필수</td>
                <td className="px-3 py-2">실명 대신 닉네임 입력 가능</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            그 외 이메일, 비밀번호, 전화번호 등 어떠한 추가 개인정보도 수집하지
            않습니다.
          </li>
          <li>
            서비스는 별도의 로그인/회원가입 절차가 없으며, 안정적 식별을 위해{" "}
            <strong>Firebase 익명 인증(Anonymous Auth)</strong>으로 발급된 익명
            식별자(uid)를 사용합니다.
          </li>
        </ul>
      </section>

      {/* 2. 이용 목적 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          2. 개인정보의 수집·이용 목적
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            <strong>서비스 이용자 수 파악</strong> — 운영자가 서비스를 이용한
            인원 수를 이름 기반으로 집계하기 위함입니다.
          </li>
          <li>
            수집한 이름은 위 목적 외의 용도(마케팅, 광고, 프로파일링 등)로
            이용하지 않습니다.
          </li>
        </ul>
      </section>

      {/* 3. 보관 기간 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          3. 개인정보의 보관 및 이용 기간
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            보관 기간: <code>{"{{보관기간 — 운영자 입력 필요}}"}</code> (예:
            서비스 종료 시까지)
          </li>
          <li>
            보관 기간이 경과하거나 처리 목적이 달성되면 해당 개인정보를 지체 없이
            파기합니다.
          </li>
        </ul>
      </section>

      {/* 4. 제3자 제공 및 처리위탁 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          4. 개인정보의 제3자 제공 및 처리위탁
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          본 서비스는 다음과 같이 개인정보 처리를 위탁합니다.
        </p>
        <div className="overflow-hidden rounded-lg border border-[#ebe9f5]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f5f4fb] text-xs font-medium text-slate-400">
              <tr>
                <th className="px-3 py-2">수탁자</th>
                <th className="px-3 py-2">위탁 업무</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-t border-[#ebe9f5]">
                <td className="px-3 py-2 font-medium">Firebase (Google LLC)</td>
                <td className="px-3 py-2">
                  개인정보(이름) 데이터 저장 및 인프라 운영
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>위탁 업무 수행 목적 외의 개인정보 처리를 금지하고 있습니다.</li>
          <li>위 수탁자 외 제3자에게 개인정보를 제공하지 않습니다.</li>
        </ul>
      </section>

      {/* 5. 동의 거부 권리 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          5. 동의를 거부할 권리 및 불이익
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            이용자는 개인정보(이름) 수집·이용에 대한 동의를 거부할 권리가
            있습니다.
          </li>
          <li>
            다만 본 서비스는 <strong>동의를 필수 게이트</strong>로 운영하므로,
            동의하지 않으면 서비스 이용이 제한됩니다.
          </li>
        </ul>
      </section>

      {/* 6. 이용자의 권리 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          6. 이용자의 권리
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를
            요청할 수 있습니다.
          </li>
          <li>
            요청은 아래 &lsquo;개인정보 보호책임자/문의처&rsquo;를 통해 접수할 수
            있습니다.
          </li>
        </ul>
      </section>

      {/* 7. 기기 내 저장 데이터 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          7. 기기 내 저장 데이터(수집 대상 아님)
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
            이 데이터는 서버로 전송되거나 운영자가 수집·열람하지 않으며, 본
            처리방침상의 &ldquo;수집하는 개인정보&rdquo;에 해당하지 않습니다.
          </li>
        </ul>
      </section>

      {/* 8. 보호책임자 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          8. 개인정보 보호책임자 및 문의처
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            개인정보 보호책임자/문의처:{" "}
            <code>{"{{담당자 연락처 — 운영자 입력 필요}}"}</code>
          </li>
        </ul>
      </section>

      {/* 9. 처리방침의 변경 */}
      <section className="rounded-2xl bg-white border border-[#ebe9f5] p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          9. 처리방침의 변경
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 leading-relaxed">
          <li>
            본 개인정보처리방침은 법령 및 서비스 변경에 따라 개정될 수 있으며,
            변경 시 서비스 내 공지를 통해 알립니다.
          </li>
        </ul>
      </section>
    </main>
  );
}
