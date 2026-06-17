import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* dev 전용: Cloudflare 터널 도메인에서 /_next 리소스 접근 허용 (프로덕션 무관) */
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
