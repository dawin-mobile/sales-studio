# decisions.md — 設計・方針判断の記録

<!-- 形式:
## YYYY-MM-DD: [何についての判断か]
- 選択肢: A / B / …
- 決定: 採用したもの
- 理由: なぜそうしたか
-->

---

## 2024〜2025: データソースを Google Sheets 直読みにする
- 選択肢: A) Sheets API 直読み / B) GAS で DB に同期してから DB 読み
- 決定: A（Sheets 直読みをメイン）
- 理由: スプレッドシートが既存の業務基盤であり移行コストがない。少人数（〜30人）かつ更新頻度が低いデータにはDBのオーバーヘッドが不要。Vercel の `revalidate=300`（5分キャッシュ）で Sheets API のクォータ制限を回避しつつ十分な即時性を確保できる。

---

## 2024〜2025: Neon DB の用途を「書き込みが必要なデータのみ」に限定する
- 選択肢: A) 全データを DB に移行 / B) Sheets をメインにして DB は書き込み系のみ
- 決定: B
- 理由: 読み取り専用の実績データは Sheets 直読みで十分。DB はシフト・日報・評価など GAS から Webhook で定期同期されるデータのみに絞り、Neon の無料枠（compute hours）を節約する。

---

## 2024〜2025: 自動同期を GAS（Google Apps Script）で行う
- 選択肢: A) GAS Webhook / B) 外部 cron サービス / C) Vercel Cron
- 決定: A（GAS）
- 理由: スプレッドシートと同じ Google エコシステム内で完結する。スプレッドシートの onEdit トリガーや時間トリガーが使えるため、外部サービス不要。既存の業務フロー（スタッフがフォームで日報提出 → Sheets 自動更新 → GAS が Webhook 送信）に自然に組み込める。

---

## 2024〜2025: 認証に NextAuth.js（credentials プロバイダー）を使う
- 選択肢: A) Google OAuth / B) 独自 credentials / C) Clerk など SaaS
- 決定: B（独自 credentials：ユーザID ＋ ハッシュパスワード）
- 理由: スタッフ全員が Google アカウントを持っていない。外部 SaaS は費用と依存リスクがある。スタッフ情報シートでユーザ管理できる方が運用が簡単。パスワードは bcrypt でハッシュ化して Sheets に保存。

---

## 2024〜2025: ホスティングを Vercel にする
- 選択肢: A) Vercel / B) AWS / C) GCP / D) Cloudflare Pages
- 決定: A（Vercel）
- 理由: Next.js との親和性が最高で設定がほぼ不要。Hobby プランで無料運用可能（〜30人の社内ツール規模）。main ブランチへの push で自動デプロイされる CI/CD が最短で構築できる。

---

## 2025: PWA 対応（インストール可能な Web アプリ）にする
- 選択肢: A) ネイティブアプリ / B) PWA / C) Web のみ
- 決定: B（PWA）
- 理由: スタッフがスマホのホーム画面に追加して使う想定。ネイティブアプリはストア申請・配布が煩雑。Web のみだと毎回 URL を開く手間がある。PWA なら Web の管理コストでアプリ体験が提供できる。

---

## 2025: secretMode（裏メニュー）でロール制限付き機能を隠す
- 選択肢: A) ロールごとにメニューを切り替え / B) 隠しジェスチャーで表示
- 決定: B（ロゴを3回タップで secretMode トグル）
- 理由: 育成管理・遅刻早退など管理者専用の機能を通常メニューに混在させるとスタッフが混乱する。隠しアクセスにすることで UI をシンプルに保ちつつ管理者だけが使える。

---

## 2025: キャッシュ戦略を Vercel の revalidate=300（5分）にする
- 選択肢: A) キャッシュなし（毎回 Sheets 読み） / B) 5分キャッシュ / C) ISR（オンデマンド再検証）
- 決定: B（5分キャッシュ）
- 理由: Sheets API の無料クォータは 300req/min。30人が同時アクセスしても同一 URL はキャッシュされるため実質 1req/5min に抑えられる。日報データは 5分の遅延が許容範囲（リアルタイム性よりクォータ安全性を優先）。

---

## 2026-06: 月別データのフォールバック（データなし時に先月を自動表示）
- 選択肢: A) コールバック方式（AttendanceTable → page.tsx へ通知して月変更） / B) fetchData 内ループ方式
- 決定: B（fetchData 内でループして対象スタッフのデータがある月を探す）
- 理由: A のコールバック方式は「データなし検知 → 月変更 → 再 fetch → データなし → 月変更」が高速で繰り返され、Google Sheets API のレート制限（Read requests per minute）を超過するバグが発生した。B は fetchData の中で最大12回の順次リクエストに制限されるため安全。
- 補足: 橋本章平（現場に出ないマネージャー）は NO_FALLBACK_USERS リストで除外。

---

## 2026-06-05: 担当タブのデータ取得ロジック
- 選択肢: A) 独自実装（スタッフ情報を主軸に知識シートを引く）/ B) 社員連絡先APIと同じロジックを再利用
- 決定: B（社員連絡先と同じ `startsWith` 照合）
- 理由: 社員連絡先（`/api/contacts`）がすでに「知識シートB列の担当姓 → スタッフ情報T列フルネームをstartWithsで照合」するロジックを確立済み。同じ問題（名前形式の不一致）を解決している実績があるため再利用した

---

## 2026-06-05: GAS管理をclaspでローカル化・フォルダ分離
- 選択肢: A) GASエディタで直接編集 / B) claspでローカル編集→push
- 決定: B（clasp）
- 理由: Claude Codeからそのまま編集・反映できる。git管理もできる。
- 構成:
  - `gas/sync-nippo/` → 日報合算GAS（スクリプトID: 1Tq50lWRhcUmWPjcJ7agsGCviOfucQ49OBV1M92EfRWBYB5L5d43y37yH）
  - `gas/sync-shift/` → 日報催促GAS（スクリプトID: 1oCZzurhVbvEHPdRZTQa1HEt34EcRXxcEU4JOGTKn5Ap9KhwQah_UlZAd）
- 注意: sync-shift に `コード.gs`・`ColorManager.gs` が上司追加済み。絶対に触らない。
- claspログインアカウント: dawinmobilebot@gmail.com
- push手順:
  - sync-nippo変更時 → `cd gas/sync-nippo && clasp push`
  - sync-shift変更時 → `cd gas/sync-shift && clasp push`

---

## 2026-06-05: Talknote実績報告をトークノート受信録と分離
- 選択肢: A) 全メールをトークノート受信録に統合 / B) 実績報告は専用シートに分離
- 決定: B（実績受信録シートに追記、DBへは送らない）
- 理由: 実績報告は長期蓄積が目的でDB同期不要。通常メッセージと混在させると管理しづらい。
- 実装: 件名の内容でシートへ振り分け。過去データ取込は各専用関数で実行。DBへは送らない。
  | 件名キーワード | 保存シート | 取込関数 |
  |---|---|---|
  | `実績報告` + `ノートに投稿しました` | 実績受信録 | `fetchJissekiEmails_PastData()` |
  | `☆関東社員☆` + `ノートに投稿しました` | 終了報告受信録 | `fetchShuryoEmails_PastData()` |
  | それ以外 | トークノート受信録 | — （DB同期あり） |

---

## 2026-06-08: GAS sync-nippo を機能ごとに複数ファイルへ分割
- 選択肢: A) 1ファイルに全機能をまとめる（目次コメント方式）/ B) 機能ごとにファイルを分ける
- 決定: B（9ファイルに分割）
- 理由: 元の sync-nippo.gs が1467行になり目的のコードを探しにくかった。GASは同プロジェクト内の複数 `.gs` ファイルをすべて同じグローバルスコープで実行するため、import不要で分割できる。
- 分割後の構成（`gas/sync-nippo/` 以下）:
  | ファイル | 内容 |
  |---|---|
  | `config.gs` | 設定値・定数・共通関数（CONFIG/DAWIN/STAFF_SYNC等） |
  | `sync-db.gs` | DB同期（syncAll・syncNippoSheet等）、1時間おき自動実行 |
  | `talknote.gs` | Talknoteメール取得・シート記録・DB同期、15分おき自動実行 |
  | `notifications.gs` | シフト通知（18時）・日報催促（21時）・日報合算 |
  | `sync-staff.gs` | スタッフ情報の転記・DB反映、6時自動実行 |
  | `sync-eval.gs` | 育成管理データ（スキル評価＋知識チェック）のDB送信、手動実行 |
  | `helpers.gs` | 内部ヘルパー関数・onEditTrigger |
  | `triggers.gs` | トリガー管理（setupTriggers/clearTriggers） |
  | `calendar.gs` | Googleカレンダーへのシフト登録、4時自動実行 |
- 注意: グローバル定数（CONFIG・DAWIN等）は `config.gs` にのみ定義。他ファイルに同名の `const` を書くと「すでに宣言済み」エラーで全体が動かなくなる。
- あわせて対処: `ジョブカン周知.js` に `send-staff-id.gs` と同名の関数（sendStaffIds・dryRun・getTargets_）があり重複警告が出ていたため、`ジョブカン周知.js` 側の関数名を `sendJobcanInfo`・`dryRunJobcan`・`getJobcanTargets_` にリネームした。
- トリガー間隔: fetchAndSyncTalknote=15分おき、syncAll=1時間おき（他は変更なし）

---

## 2026-06: 合算データの mergeSheets_Complete を全削除→上書きにする
- 選択肢: A) 全削除→上書き / B) 追記方式（重複チェックあり）
- 決定: A（全削除→上書き）
- 理由: 追記方式は GAS の定期実行（10分おき）で重複データが蓄積される。フォームの誤入力訂正も全書き直しで自動反映される。ただし FormSheetA のグループ化（折りたたみ）でデータが消える問題あり（→ 経理スタッフに折りたたみ運用要相談）。
