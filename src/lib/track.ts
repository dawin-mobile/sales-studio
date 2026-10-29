// アクセスログ（スプレッドシート「アクセスログ」）に1件記録する。記録に失敗しても画面の操作は止めない。
// 記録した名前がそのまま「機能別アクセス数」の項目名になる
export function trackAccess(tab: string) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab }),
  }).catch(() => {});
}
