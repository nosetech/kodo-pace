#!/usr/bin/env bash
# 同一Wi-Fi内のタブレット等からアクセスできるよう、全インターフェースで
# 簡易HTTPサーバーを起動し、LAN側のアクセスURLを表示する。
#
# 注意: Web Speech API(マイクアクセス)はセキュアコンテキスト
# (https:// または localhost)でのみ動作する。この方法(http://<LAN IP>:...)
# でアクセスした場合、他のPWA機能と異なりマイクへのアクセス自体が
# ブラウザにブロックされ、録音ボタンを押しても反応しない。
# LAN経由で実機検証したい場合は README の「実機での動作確認方法」を参照。
set -euo pipefail

PORT="${1:-8935}"
cd "$(dirname "$0")"

LAN_IP=$(python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    s.connect(('8.8.8.8', 80))
    print(s.getsockname()[0])
finally:
    s.close()
" 2>/dev/null || echo "取得できませんでした(Wi-Fiに接続されているか確認してください)")

echo "=================================================================="
echo " このPC上で確認(マイクアクセス可):  http://localhost:${PORT}/index.html"
echo " 同一Wi-Fi内の端末から(マイクアクセス不可・要追加対応): http://${LAN_IP}:${PORT}/index.html"
echo "=================================================================="
echo " 停止するには Ctrl+C を押してください。"
echo ""

exec python3 -m http.server "$PORT" --bind 0.0.0.0
