#!/usr/bin/env bash
# 同一Wi-Fi内のタブレット等からアクセスできるよう、全インターフェースで
# 簡易HTTPサーバーを起動し、LAN側のアクセスURLを表示する。
set -euo pipefail

PORT="${1:-8934}"
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
echo " このPC上で確認:      http://localhost:${PORT}/index.html"
echo " 同一Wi-Fi内の端末から: http://${LAN_IP}:${PORT}/index.html"
echo "=================================================================="
echo " 停止するには Ctrl+C を押してください。"
echo ""

exec python3 -m http.server "$PORT" --bind 0.0.0.0
