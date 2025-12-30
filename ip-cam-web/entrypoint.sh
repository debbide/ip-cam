#!/bin/sh
set -e

echo "=========================================="
echo "  IP Cam Streamer - Web Edition"
echo "=========================================="

# 生成自签名证书（如果不存在）
echo "[Entrypoint] Checking SSL certificate..."
/usr/local/bin/generate-cert.sh

# 创建必要目录
mkdir -p /app/data /var/log/nginx

# 配置 WebRTC 外部 IP（如果设置了环境变量）
if [ -n "$WEBRTC_EXTERNAL_IP" ]; then
    echo "[Entrypoint] Configuring WebRTC external IP: $WEBRTC_EXTERNAL_IP"
    # 在 mediamtx 配置中添加 webrtcAdditionalHosts
    sed -i "/webrtcAllowOrigin/a webrtcAdditionalHosts:\\n  - $WEBRTC_EXTERNAL_IP" /etc/mediamtx.yml
fi

echo "[Entrypoint] Starting services..."
echo "  - Nginx (HTTPS on :443)"
echo "  - MediaMTX (RTSP/HLS/WebRTC)"
echo "  - API Server (:3001 internal)"
echo "=========================================="

# 启动 Supervisor
exec supervisord -c /etc/supervisord.conf
