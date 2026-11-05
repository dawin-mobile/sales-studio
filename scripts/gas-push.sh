#!/bin/bash
# GAS を安全に clasp push する。
#
# clasp push は GAS プロジェクトをフォルダの中身で丸ごと置き換えるので、
# 上司などが GAS エディタで直接直した部分が消える（Apps Script に変更履歴はない）。
# そこで push の前に、今の GAS の中身を一時フォルダに clasp pull し、
# 最後にコミットした内容（git の HEAD）と比べる。違いがあれば push しない。
#
# 使い方（自分の変更はコミットする前に実行し、push できたらコミットする）:
#   scripts/gas-push.sh gas/sync-nippo
#   scripts/gas-push.sh gas/sync-shift
set -euo pipefail

dir="${1:?使い方: scripts/gas-push.sh gas/sync-nippo}"
dir="${dir%/}"
cd "$(git rev-parse --show-toplevel)"
[ -f "$dir/.clasp.json" ] || { echo "❌ $dir/.clasp.json がありません"; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/remote" "$tmp/head"

echo "▶ 今の GAS の中身を取得しています（clasp pull）"
cp "$dir/.clasp.json" "$tmp/remote/"
(cd "$tmp/remote" && clasp pull > /dev/null)
rm "$tmp/remote/.clasp.json"

git archive HEAD "$dir" | tar -x -C "$tmp/head"
head_dir="$tmp/head/$dir"

# clasp pull は .gs を .js として取ってくるので、拡張子を除いた名前で比べる
key_of() { local n; n=$(basename "$1"); case "$n" in *.gs|*.js) echo "${n%.*}" ;; *) echo "$n" ;; esac; }
find_remote() { local k="$1"; for f in "$tmp/remote/$k" "$tmp/remote/$k.js" "$tmp/remote/$k.gs"; do [ -f "$f" ] && { echo "$f"; return; }; done; }

# .claspignore に書いたファイルは push しないので、比べる対象から外す
ignored=""
[ -f "$dir/.claspignore" ] && ignored=$(cat "$dir/.claspignore")
is_ignored() { echo "$ignored" | grep -qxF "$(basename "$1")"; }

problems=0
for f in "$head_dir"/*; do
  [ -f "$f" ] || continue
  is_ignored "$f" && continue
  r=$(find_remote "$(key_of "$f")")
  if [ -z "$r" ]; then
    echo "⚠️  GAS にない: $(basename "$f")"; problems=1
  elif ! diff -q "$f" "$r" > /dev/null; then
    echo "⚠️  GAS 側で変わっている: $(basename "$f")"; diff -u "$f" "$r" | head -40; problems=1
  fi
done
for r in "$tmp/remote"/*; do
  [ -f "$r" ] || continue
  k=$(key_of "$r")
  if [ ! -f "$head_dir/$k" ] && [ ! -f "$head_dir/$k.gs" ] && [ ! -f "$head_dir/$k.js" ]; then
    echo "⚠️  GAS にだけある: $(basename "$r")"; problems=1
  fi
done

if [ "$problems" -ne 0 ]; then
  echo ""
  echo "❌ push を止めました。GAS エディタで直接直された部分か、コミットしていない push があります。"
  echo "   上の差分を確認し、残すべき変更なら手元に取り込んでコミットしてから、もう一度実行してください。"
  exit 1
fi

echo "✅ GAS の中身は最後のコミットと同じです。push します"
(cd "$dir" && clasp push)
