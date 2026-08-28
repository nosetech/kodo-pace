#!/usr/bin/env bash
# docs/ 配下の Markdown に、日本語ドキュメントとして想定していない文字体系
# (キリル文字・ギリシャ文字など)が混入していないかをチェックする。
#
# 過去に、AIによる一括生成時のドラフト残骸(下書き行の消し忘れ)が
# 意味不明な文字列としてコミットされた事例があったため、その再発防止用。
#
# 使い方: scripts/check-doc-artifacts.sh [対象ディレクトリ ...]
#   引数なしの場合は docs/ 配下の *.md 全体を対象にする。

set -euo pipefail

targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  targets=("docs")
fi

# キリル文字(U+0400-04FF)・ギリシャ文字(U+0370-03FF)を許容しない文字体系として検出する。
# 日本語(ひらがな・カタカナ・漢字)・英数字・全角記号は正常な範囲なので対象外。
pattern='[\x{0400}-\x{04FF}\x{0370}-\x{03FF}]'

found=0
while IFS= read -r -d '' file; do
  if matches=$(grep -nP "$pattern" "$file" 2>/dev/null); then
    echo "::error file=${file}::不審な文字(キリル文字/ギリシャ文字)を検出しました"
    echo "$matches" | while IFS= read -r line; do
      echo "  ${file}:${line}"
    done
    found=1
  fi
done < <(find "${targets[@]}" -type f -name '*.md' -print0)

if [ "$found" -eq 1 ]; then
  echo ""
  echo "生成ドラフトの消し忘れやAI生成時の文字化けの可能性があります。該当箇所を確認・修正してください。"
  exit 1
fi

echo "OK: 不審な文字は検出されませんでした。"
