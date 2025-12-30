# IP Cam Streamer - Web Edition

一键部署的 IP 摄像头监控系统，支持浏览器直接访问（HTTPS + WebRTC）。

## 特性

- **一键部署**: 单个 Docker 容器包含所有服务
- **HTTPS 支持**: 自动生成自签名证书，WebRTC 可用
- **多协议**: 支持 WebRTC（低延迟）/ HLS（兼容性好）/ MJPEG
- **智能检测**: 内置移动侦测和人形检测（TensorFlow.js）
- **多端报警**: 支持 Telegram、企业微信、钉钉通知

## 快速开始

### 1. 构建镜像

```bash
cd ip-cam-web
docker-compose build
```

### 2. 启动服务

```bash
docker-compose up -d
```

### 3. 访问界面

打开浏览器访问: `https://你的服务器IP`

> **注意**: 首次访问会提示证书不安全，点击"继续访问"即可。这是因为使用了自签名证书。

## 端口说明

| 端口 | 协议 | 用途 |
|------|------|------|
| 443 | HTTPS | Web 界面（主入口） |
| 80 | HTTP | 自动重定向到 HTTPS |
| 8554 | RTSP | RTSP 流访问 |
| 8289/udp | UDP | WebRTC ICE |

## 架构

```
浏览器 (HTTPS)
    │
    ▼
┌─────────────────────────────────────────┐
│              Nginx (443)                │
│  ┌─────────────────────────────────┐    │
│  │  /        → 前端静态文件         │    │
│  │  /api/*   → API Server (3001)   │    │
│  │  /whep/*  → MediaMTX WebRTC     │    │
│  │  /hls/*   → MediaMTX HLS        │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  API Server │ MediaMTX │ Supervisor     │
└─────────────────────────────────────────┘
```

## 数据持久化

- `/app/data` - 摄像头配置、录像文件
- `/etc/nginx/ssl` - SSL 证书（自动生成）

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| TZ | Asia/Shanghai | 时区 |

## 常见问题

### WebRTC 无法连接？

1. 确保使用 HTTPS 访问（浏览器地址栏显示锁图标）
2. 检查防火墙是否开放 8289/udp 端口
3. 查看浏览器控制台是否有错误

### 如何使用自己的证书？

挂载证书文件到容器：

```yaml
volumes:
  - ./my-cert.crt:/etc/nginx/ssl/server.crt:ro
  - ./my-cert.key:/etc/nginx/ssl/server.key:ro
```

### 如何查看日志？

```bash
docker logs -f ip-cam-web
```

## 开发

### 本地构建

```bash
# 在项目根目录
docker build -f ip-cam-web/Dockerfile -t ip-cam-web .
```

### 推送到 GitHub Container Registry

```bash
docker tag ip-cam-web ghcr.io/你的用户名/ip-cam-web:latest
docker push ghcr.io/你的用户名/ip-cam-web:latest
```

## License

MIT
