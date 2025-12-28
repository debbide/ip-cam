# IP Cam Streamer - 前后端分离版

本项目将 IP Cam Streamer 拆分为独立的前端和后端，实现：
- **后端 (Docker)**: 部署在服务器，负责流媒体转码
- **前端 (Electron)**: 本地客户端，连接远程后端播放视频

## 架构

```
┌─────────────────────────┐         ┌─────────────────────────────┐
│   Electron 客户端        │         │   Docker 后端 (服务器)       │
│   (用户本地电脑)         │         │                             │
│                         │  HTTP   │   ┌─────────────────────┐   │
│   设置服务器地址 ────────────────► │   │ RTSP-Server API     │   │
│   192.168.1.100:3001    │         │   │ :3001               │   │
│                         │         │   └─────────────────────┘   │
│   WebRTC 播放 ───────────────────► │   ┌─────────────────────┐   │
│                         │  WHEP   │   │ MediaMTX            │   │
│                         │         │   │ :8554 :8888 :8889   │   │
│   截图/录像保存 → 本地    │         │   └─────────────────────┘   │
└─────────────────────────┘         └─────────────────────────────┘
```

## 后端部署 (Docker)

### 目录结构
```
backend/
├── rtsp-server/          # API 服务
│   ├── src/index.js
│   └── package.json
├── Dockerfile
├── docker-compose.yml
├── mediamtx.yml
└── supervisord.conf
```

### 启动后端
```bash
cd backend

# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

### 自定义端口
```bash
API_PORT=3001 RTSP_PORT=8554 HLS_PORT=8888 WEBRTC_PORT=8889 docker-compose up -d
```

### 端口说明
| 端口 | 协议 | 用途 |
|------|------|------|
| 3001 | HTTP | API 接口 |
| 8554 | RTSP | RTSP 流媒体 |
| 8888 | HTTP | HLS 流媒体 |
| 8889 | HTTP | WebRTC (WHEP) |

## 前端开发 (Electron)

### 目录结构
```
frontend/
├── electron/             # Electron 主进程
│   ├── main.js          # 精简版（无 MediaMTX）
│   └── preload.js
├── src/                  # React 前端
│   ├── contexts/
│   │   └── ServerContext.tsx    # 服务器配置上下文
│   ├── components/
│   │   └── ServerConfigDialog.tsx  # 服务器配置界面
│   └── ...
├── package.json
└── ...
```

### 安装依赖
```bash
cd frontend
npm install
```

### 开发模式
```bash
# 启动 Vite 开发服务器
npm run dev

# 另一个终端启动 Electron
npm run start:electron
```

### 构建 Windows 可执行文件
```bash
npm run build:win
```

## 使用说明

### 1. 部署后端
在服务器上启动 Docker 容器：
```bash
cd backend
docker-compose up -d
```

### 2. 启动前端
启动 Electron 客户端后，点击右上角的「服务器配置」按钮：
- 输入服务器地址（如 `192.168.1.100`）
- 确认端口配置
- 点击「测试连接」验证
- 保存配置

### 3. 添加摄像头
- 点击「添加设备」
- 输入摄像头信息（IP、端口、用户名、密码）
- 选择流类型（推荐 WebRTC）
- 保存后开始播放

## API 接口

### 获取服务器信息
```bash
GET /api/server-info
```

### 添加 RTSP 流
```bash
POST /api/streams
Content-Type: application/json

{
  "id": "camera1",
  "rtspUrl": "rtsp://user:pass@192.168.1.100:554/stream"
}
```

### 获取所有流
```bash
GET /api/streams
```

### 删除流
```bash
DELETE /api/streams/:id
```

### 系统统计
```bash
GET /api/system-stats
```

### 健康检查
```bash
GET /health
```

## 技术栈

### 后端
- Node.js 20
- Express 5
- MediaMTX (RTSP/HLS/WebRTC)
- Docker + Supervisor

### 前端
- React 18 + TypeScript
- Vite 5
- Electron 39
- TailwindCSS + shadcn/ui
- TensorFlow.js (人形检测)

## 注意事项

1. **WebRTC 需要 Electron**: 浏览器通过 HTTP 访问远程服务器时，WebRTC 会因安全策略被禁用。使用 Electron 客户端可以绕过此限制。

2. **MJPEG 直连**: 如果使用 MJPEG 流类型，客户端会直接连接到摄像头，不经过后端服务器。

3. **截图/录像本地保存**: 所有截图和录像都保存在客户端本地，不会上传到服务器。

4. **配置持久化**: 服务器配置和摄像头配置都保存在客户端本地 (localStorage)。
