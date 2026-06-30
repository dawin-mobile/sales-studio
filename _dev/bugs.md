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

## 2026-06-09: 実績報告が「その他」に入り現場に紐づかない
- 症状: 6/7の実績報告が6/9に受信され、6/7を開くと「その他」グループに表示された
- 原因①: GASのメール処理が翌日以降になるケースがある。受信日付（6/9）で絞り込むとシフト日付（6/7）と一致せず現場が特定できない
- 原因②: 実績報告メッセージ本文には「6月7日(日)」という営業日が書かれている
- 解決: 受信日付でのフィルタリングを廃止し、メッセージ本文の「M月D日」を正規表現で抽出して営業日で照合する方式に変更
- 再発防止: 受信録系のデータは「メールを受信した日 ≠ 営業日」になり得る。日付フィルタはメッセージ本文を優先する

## 2026-06-09: 実績報告タブのMNP/新規バッジが過大カウント
- 症状: 実績報告タブで「MNP 9台・新規 10台」と表示された（正しくはMNP 2台）
- 原因: `countMnpNew` がTalknoteの短文メッセージ向けに作られており、実績報告の構造化テキスト内の「au MNP：」「UQ MNP：」「新規HS：2」などを全部拾ってしまった
- 解決: 実績報告タブのバッジ計算は実績報告テキストを解析せず、Talknoteタブと同じ `data.siteMap` を流用する（`badgeSiteMap` プロップで渡す）
- 再発防止: 構造化された長文テキストに対して `countMnpNew` を使うと誤カウントする。異なるフォーマットには別の計算ロジックが必要

## 2026-06-05: 担当タブで担当社員名が全員空になる
- 症状: 担当タブにアルバイト名と役職は表示されるが「担当：〇〇」の社員名が全員空
- 原因: スタッフ情報A列の名前（フルネーム「木付翔太」）と知識シートA列の名前（短縮形「木付」）が一致せずjoinが失敗していた
- 解決: 社員連絡先API（`/api/contacts`）と同じアプローチを採用。知識シートB列の担当「姓」とスタッフ情報T列のフルネームを`startsWith`で照合するロジックに切り替え
- 再発防止: スプレッドシート間で名前を結合するときは必ずフォーマットを確認する。知識シートは短縮名、スタッフ情報T列はフルネームという違いがある

## 2026-06-30: GAS syncAllが6分でタイムアウトする
- 症状: syncAll実行時に「シフト同期開始: 2026-06」のログ1件だけで6分後にExceeded maximum execution timeエラー
- 原因: GAS ConfigにSYNC_URL（旧: sales-studio-iota）とSYNC_URL_NEW（新: dawin-sales-studio）の2つのURLがあり直列実行。旧URLは正常だが新URLのVercel Functionがタイムアウト。原因はVercel FunctionのリージョンがNorth America(iad1)なのにNeon DBがSingaporeにあり、DB書き込みクエリが10秒制限を超えていた
- 解決: Vercel ダッシュボード Settings → Functions → Function Region を Asia Pacific (sin1 = Singapore) に変更してリデプロイ
- 再発防止: Vercel FunctionのリージョンはNeon DBのリージョンに合わせること。dawin-sales-studioのNeonはAWS Asia Pacific 1 (Singapore)

## 2026-06-30: シフト現場別ビューで外部スタッフのバッジが出ない
- 症状: HEキャッチ・福留バルーン・FFU/保土ヶ谷などがDBに入っているのにシフト画面に表示されない
- 原因1: GASのparseShiftRows_でstaffNameSetフィルタが効いており、ヘッダー行の名前リストにない外部スタッフが除外されてDBに保存されていなかった
- 原因2: ShiftView.tsxのvisibleStaff（バッジ描画）にもstaffNameSetフィルタがあり、DBに入っていても表示されなかった
- 解決1: GAS sync-shift.gsのstaffNameSetフィルタを削除（列H〜S の空でない値をすべてstaffに含める）
- 解決2: ShiftView.tsxのvisibleStaffフィルタからstaffNameSet条件を削除（✖系のみ除外）
- 再発防止: GASとフロントの両方に同じフィルタが二重にかかっていた。外部スタッフの表示制御はどちらか一方で行う
