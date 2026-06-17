interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
}

/**
 * 비교표 렌더. 실제 <table>로 그리고, max-w-md에서 넘치는 4열 표를 위해
 * 바깥을 overflow-x-auto로 감싼다(가로 스크롤).
 */
export function ComparisonTable({ headers, rows }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#ebe9f5]">
      <table className="w-full min-w-[28rem] border-collapse text-left">
        <thead>
          <tr className="bg-[#f5f4fb]">
            {headers.map((h, i) => (
              <th
                key={i}
                className="border-b border-[#ebe9f5] px-3 py-2 text-xs font-medium text-slate-700"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-[#ebe9f5] last:border-b-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2 align-top text-xs text-slate-600 sm:text-sm"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
