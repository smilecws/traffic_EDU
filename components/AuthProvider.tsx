"use client";

import { useEffect } from "react";
import { ensureAnonymousSignIn } from "@/lib/services/authService";

/**
 * 앱 마운트 시 1회 익명 로그인을 시도한다 (best-effort, silent).
 * 인증 결과를 기다리지 않고 children을 그대로 렌더한다 (블로킹 금지).
 */
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    void ensureAnonymousSignIn();
  }, []);

  return <>{children}</>;
}
