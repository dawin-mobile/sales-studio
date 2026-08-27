
「# Sales Studio

携帯販売スタッフ向けの業績管理・シフト確認Webアプリ。

- **本番URL**: https://dawin-sales-studio.vercel.app
- **リポジトリ**: https://github.com/dawin-mobile/sales-studio

---

## 概要

スプレッドシートで管理していた販売実績・シフト・スタッフ情報をWebアプリ上で見やすく表示する社内ツール。スマホ・PCどちらからでもアクセス可能なPWA対応のWebアプリ。

---

## 機能一覧

### 一般スタッフ向け

| 機能 | 内容 |
|------|------|
| ダッシュボード | 当月の獲得件数・KPI・Top10チャート・ランキング表示 |
| ランキング | MNP・新規・SU等の種別ごとのランキング表示 |
| 実績・分析 | 月別推移グラフ・年代別・機種別の分析 |
| 個人実績 | スタッフごとのカレンダー形式の日別実績 |
| シフト | 現場別・スタッフ別・社員のシフト確認 |
| スタッフ | スタッフ情報・プロフィール一覧 |
| インセンティブバー | 獲得ptに応じたランク・インセン金額の進捗表示 |

### 管理者向け（裏メニュー）

| 機能 | 内容 |
|------|------|
| 育成管理 | スタッフの評価スコア・知識習熟度の管理 |
| 遅刻/早退 | 遅刻・早退の記録管理（準備中） |
| スタッフ切り替え | 管理者が任意のスタッフ視点で画面確認 |
| ログイン情報 | スタッフのログイン日時確認 |

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 15（App Router） |
| 言語 | TypeScript |
| スタイリング | CSS（globals.css） |
| 認証 | NextAuth.js（Google OAuth） |
| データベース | Neon DB（PostgreSQL）+ Drizzle ORM |
| データソース | Google Sheets API（スプレッドシート直読み） |
| ホスティング | Vercel |
| 自動同期 | Google Apps Script（GAS）→ Webhook → DB |

---

## データフロー

```
スプレッドシート
  └─ GAS（定期実行）
       └─ POST /api/sync（Webhook）
            └─ Neon DB（シフト・日報・評価データ）

Google Sheets API（直読み）
  └─ ダッシュボード・実績・スタッフ情報
```

---

## 画面構成

```
/（ログイン後）
├── ホーム（ダッシュボード）
├── ランキング
├── 実績・分析
├── シフト
└── スタッフ
```

---

## 主要ファイル

```
src/
├── app/
│   ├── page.tsx              # メインページ
│   ├── globals.css           # スタイル
│   └── api/
│       ├── sync/             # GASからのWebhook受信
│       ├── shift/            # シフトデータ取得
│       ├── data/             # ダッシュボードデータ
│       ├── talknote/         # 日報データ
│       └── profile/          # スタッフ情報
├── components/               # UIコンポーネント
├── lib/
│   ├── db.ts                 # DBクライアント
│   ├── sheets.ts             # Google Sheets APIクライアント
│   └── schema.ts             # DBテーブル定義
└── types/
    └── index.ts              # 型定義
gas/
├── sync-nippo.gs             # 日報・Talknote同期スクリプト
└── sync-shift.gs             # シフト同期スクリプト
```

---

## 開発環境のセットアップ

```bash
npm install
npm run dev
```

`.env.local` に以下の環境変数が必要：

```
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_SERVICE_ACCOUNT_KEY=
SPREADSHEET_ID=
SYNC_SECRET=
IKUSEI_SSO_SECRET=
```

`IKUSEI_SSO_SECRET` は育成アプリ（別アプリ）とのSSO用の共通シークレット。育成アプリ側の `SSO_SHARED_SECRET` と**同じ値**を設定する。未設定でもアプリは動作するが、「育成アプリ」ボタンが合言葉入力画面へフォールバックする。

---

## デプロイ

GitHub の `main` ブランチへの push で Vercel が自動デプロイ。
