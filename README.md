# Android IP Cam Streamer

监控多个 Android 设备摄像头的 Web 应用。

## 功能特性

- 📷 多摄像头实时监控
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

## 📱 Android 端准备

推荐使用 **IP Camera** 应用将手机变成网络摄像头：
- **下载地址**：[Google Play Store](https://play.google.com/store/apps/details?id=com.shenyaocn.android.WebCam&hl=zh)
- 或者使用同类型的其他支持 RTSP/MJPEG/ONVIF 的应用自行测试。

---

## 🖥️ Windows 部署（推荐）

本项目目前**不支持 Docker 部署**，请直接使用 Windows 可执行文件。

1. 在 Releases 页面下载最新的 `IP.Cam.Streamer.x.x.x.exe`
2. 双击运行即可（支持便携模式，数据存储在同级目录下）

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
