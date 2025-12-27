# IP Cam Streamer

一个用于 **集中监控多个 Android 设备摄像头** 的 Web 应用，适合在局域网环境中进行实时视频查看与管理。

## ✨ 功能特性

- **📷 多摄像头实时监控**：同时查看多个 Android 设备的视频画面
- **🎥 视频录制 & 截图**：支持手动或事件触发的录像与抓拍
- **🔔 移动侦测**：基于视频流的移动检测能力
- **👤 用户管理**：支持基础的访问控制与用户管理

## 🧱 技术栈

- **Vite** — 前端构建工具
- **React 18** — 前端框架
- **TypeScript** — 类型系统
- **Tailwind CSS** — 原子化样式框架
- **shadcn-ui** — UI 组件库

---

## 📱 移动端准备（重要）

本项目依赖移动设备提供视频流，推荐并优先支持以下应用：

### 🤖 Android

**IP Camera** (by ShenYao)

- **下载地址**：[Google Play Store](https://play.google.com/store/apps/details?id=com.shenyaocn.android.WebCam&hl=zh)

### 🍎 iOS

**IP摄像头Lite** (by ShenYao)

- **下载地址**：[App Store](https://apps.apple.com/us/app/ip%E6%91%84%E5%83%8F%E5%A4%B4lite/id1013455241?l=zh-Hans-CN)

### 使用说明

1. 在手机上安装对应版本的 **IP Camera** 应用
2. 确保手机与运行本项目的电脑处于 **同一局域网**
3. 在应用中启动摄像头服务
4. 获取应用中提供的 `RTSP` / `MJPEG` / `HTTP` 视频流地址
5. 将该地址配置到本项目中进行访问

> **⚠️ 说明**
> - 仅保证与上述应用的兼容性
> - 其他支持 RTSP / MJPEG / ONVIF 的摄像头应用可自行测试，但不保证完全可用

---

## 🖥️ Windows 部署（推荐）

> **❌ 本项目当前不支持 Docker 部署**

如果你只是使用，不进行二次开发，推荐使用 Windows 可执行文件。

### 使用步骤

1. 前往 [Releases](../../releases) 页面
2. 下载最新版本的 `IP.Cam.Streamer.x.x.x.exe`
3. 双击运行即可

### 特点

- 无需安装 Node.js
- 支持 **便携模式**
- 数据与配置文件存储在 exe 同级目录

---

## 💻 本地开发

适合需要二次开发或自定义功能的用户。

### 环境要求

- Node.js ≥ 18
- npm 或 pnpm

### 启动项目

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

开发服务器默认运行在：`http://localhost:8080`

### 📦 生产构建

```bash
npm run build
```

构建完成后，产物将生成在 `dist/` 目录，可用于静态部署或进一步打包。

---

## ⚠️ 免责声明

- 本项目仅用于 **学习、研究和合法用途**
- 请遵守当地法律法规
- **禁止用于任何形式的非法监控或侵犯隐私行为**
