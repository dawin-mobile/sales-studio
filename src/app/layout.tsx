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
    // data-theme は下のスクリプトが描画前に書き換えるので、サーバーとの食い違いの警告を出さない
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* 白基調を選んでいる端末では、画面が出る前に色を切り替える（一瞬黒く光らないように） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='light')document.documentElement.dataset.theme='light'}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
