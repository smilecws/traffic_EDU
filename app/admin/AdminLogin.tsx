"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";

/**
 * 관리자 비밀번호 입력 폼.
 *
 * 비밀번호는 서버(`/api/admin/session`)에서만 검증한다 — 브라우저 코드에
 * 비밀번호나 그 해시가 들어가지 않는다. 성공 시 httpOnly 쿠키가 발급된다.
 */
export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setPassword("");
        onSuccess();
        return;
      }
      if (res.status === 503) {
        setError(
          "서버에 관리자 비밀번호(ADMIN_PASSWORD)가 설정되지 않았습니다.",
        );
      } else {
        setError("비밀번호가 올바르지 않습니다.");
      }
    } catch {
      setError("네트워크 오류입니다. 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-slate-900">관리자 확인</h1>
        <p className="text-sm text-slate-600">
          교육 회차별 오답률을 보려면 관리자 비밀번호를 입력하세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            className="w-full rounded-xl border border-[#ebe9f5] px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {busy ? "확인 중…" : "확인"}
        </Button>

        <p className="text-xs text-slate-400">
          확인 후 12시간 동안 유지됩니다.
        </p>
      </form>
    </Card>
  );
}
