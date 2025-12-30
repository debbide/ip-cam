#!/bin/sh
# 生成自签名 SSL 证书

SSL_DIR="/etc/nginx/ssl"
CERT_FILE="$SSL_DIR/server.crt"
KEY_FILE="$SSL_DIR/server.key"

# 如果证书已存在且未过期，跳过生成
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    # 检查证书是否在30天内过期
    if openssl x509 -checkend 2592000 -noout -in "$CERT_FILE" 2>/dev/null; then
        echo "[SSL] Certificate exists and is valid, skipping generation"
        exit 0
    fi
    echo "[SSL] Certificate expired or expiring soon, regenerating..."
fi

echo "[SSL] Generating self-signed certificate..."

mkdir -p "$SSL_DIR"

# 生成自签名证书，有效期 10 年
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=IPCam/OU=Streaming/CN=ipcam.local" \
    -addext "subjectAltName=DNS:localhost,DNS:ipcam.local,IP:127.0.0.1"

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "[SSL] Certificate generated successfully:"
echo "      - Certificate: $CERT_FILE"
echo "      - Private Key: $KEY_FILE"
echo "      - Valid for: 10 years"
