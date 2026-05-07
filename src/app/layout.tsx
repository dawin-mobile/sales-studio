import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "Sales Studio",
  description: "営業成績ダッシュボード",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sales Studio",
  },
  icons: {
    apple: "/icon4g-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
