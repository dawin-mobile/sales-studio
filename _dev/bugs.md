# bugs.md — 既知のバグ・ハマりポイント記録

<!-- 形式:
## YYYY-MM-DD: [一言でどんなバグか]
- 症状: 何が起きたか
- 原因: 本当の原因
- 解決: どう直したか
- 再発防止: 次に気をつけること
-->

## 2026-06-03: 自動遡りのコールバック方式でSheetsクォータ超過
- 症状: 「データがありません」→自動で月を遡る処理を実装後、Google Sheetsの「Read requests per minute per user」クォータエラーが頻発した
- 原因: AttendanceTableからpage.tsxへのコールバック方式だと「データなし検知 → setSelectedMonth → 再fetch → データなし → setSelectedMonth → ...」が高速で繰り返され、12回のSheets読み取りが数秒以内に走った。各月は異なるURLなのでVercelキャッシュが効かず毎回Sheetsを読む
- 解決: コールバック方式を廃止し、`fetchData`内のforループで最大12ヶ月を順次チェックする方式に変更。ループが1関数内に収まるため制御しやすい
- 再発防止: 「月を変えながらAPIを複数回叩く」処理はコールバック連鎖ではなく、必ず1つの非同期関数内のループで実装する

## 2026-06-05: 担当タブがPCサイドバーに表示されない
- 症状: スマホのBottomNavには担当タブが出るがPCのSidebarには出ない
- 原因: Sidebar.tsxのsecretModeフィルターが `item.id === 'growth' || item.id === 'tardiness'` とハードコードされており、新しいタブ追加時に更新し忘れた
- 解決: フィルター条件に `|| item.id === 'tantou'` を追加
- 再発防止: secretMenuに新タブを追加するときはSidebar.tsxのsecretModeフィルター（62〜64行付近）とBottomNav.tsxのSECRET_NAV_ITEMSの両方を必ず確認する

## 2026-06-05: clasp push で別プロジェクトのファイルを誤pushした
- 症状: sync-nippo GASに `sync-shift.gs`・`send-staff-id.gs` が混入した
- 原因: `gas/` フォルダにファイルが混在した状態で clasp clone → push したため、全ファイルが sync-nippo プロジェクトにpushされた
- 解決: `.claspignore` で対象外ファイルを除外して再push → GASから削除された。フォルダを `sync-nippo/` と `sync-shift/` に分離
- 再発防止: clasp push 前に必ず `gas/` のフォルダ構成を確認。各プロジェクトは専用サブフォルダで管理する

## 2026-06-05: 担当タブで担当社員名が全員空になる
- 症状: 担当タブにアルバイト名と役職は表示されるが「担当：〇〇」の社員名が全員空
- 原因: スタッフ情報A列の名前（フルネーム「木付翔太」）と知識シートA列の名前（短縮形「木付」）が一致せずjoinが失敗していた
- 解決: 社員連絡先API（`/api/contacts`）と同じアプローチを採用。知識シートB列の担当「姓」とスタッフ情報T列のフルネームを`startsWith`で照合するロジックに切り替え
- 再発防止: スプレッドシート間で名前を結合するときは必ずフォーマットを確認する。知識シートは短縮名、スタッフ情報T列はフルネームという違いがある
