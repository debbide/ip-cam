# Android IP Cam Streamer

监控多个 Android 设备摄像头的 Web 应用。

## 功能特性

- 📷 多摄像头实时监控
- 🎛️ PTZ 云台控制
- 🎥 视频录制 & 截图
- 🔔 移动侦测
- 👤 用户管理

## 技术栈

- **Vite** - 构建工具
- **React 18** - 前端框架
- **TypeScript** - 类型系统
- **Tailwind CSS** - 样式框架
- **shadcn-ui** - UI 组件库

---

## 🐳 Docker 部署（推荐）

### 方式一：Docker Compose（推荐）

```bash
# 克隆项目
git clone <YOUR_GIT_URL>
cd android-ip-cam-streamer

# 启动服务（默认端口 3000）
docker-compose up -d

# 自定义端口
WEB_PORT=8080 docker-compose up -d

# 停止服务
docker-compose down
```

### 方式二：手动 Docker 构建

```bash
# 构建镜像
docker build -t ip-cam-streamer .

# 运行容器
docker run -d -p 3000:80 --name ip-cam-streamer ip-cam-streamer

# 停止容器
docker stop ip-cam-streamer && docker rm ip-cam-streamer
```

访问 `http://localhost:3000` 即可使用。

---

## 💻 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

开发服务器将在 `http://localhost:8080` 启动。

---

## 📦 生产构建

```bash
npm run build
```

构建产物位于 `dist/` 目录。
