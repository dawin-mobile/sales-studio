import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 資料のファイル（content/shiryo/files/）を Vercel の関数に同梱する。
  // ファイル名が動的なので、指定しないと自動では含まれない
  outputFileTracingIncludes: {
    '/api/shiryo/file/[name]': ['./content/shiryo/files/**'],
  },
};

export default nextConfig;
