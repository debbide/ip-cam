import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import fs from 'fs';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// 存储活跃的转码进程
const streams = new Map();

const MEDIAMTX_API = process.env.MEDIAMTX_API || 'http://127.0.0.1:9997';
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '../../public');
const HLS_DIR = process.env.HLS_OUTPUT_DIR || '/var/hls';

// FFmpeg 路径 (开发环境和打包后的路径)
// 注意：必须在函数内部获取 process.env.RESOURCES_PATH，因为在模块加载时该环境变量可能尚未设置（被 main.js 设置）
function getFFmpegPath() {
    const RESOURCES_PATH = process.env.RESOURCES_PATH || path.join(__dirname, '../..');
    return path.join(RESOURCES_PATH, 'bin/ffmpeg.exe');
}

/**
 * 启动 FFmpeg 转码流 (AAC -> Opus)
 */
async function startTranscoding(streamId, rtspUrl) {
    const ffmpegPath = getFFmpegPath();
    console.log(`[${streamId}] Starting FFmpeg transcoding: ${rtspUrl}`);
    console.log(`[${streamId}] FFmpeg path: ${ffmpegPath}`);

    // 检查 FFmpeg 是否存在
    if (!fs.existsSync(ffmpegPath)) {
        throw new Error(`FFmpeg not found at ${ffmpegPath}`);
    }

    // FFmpeg 参数: 拉取 RTSP 源, 视频直接复制, 音频转码为 Opus, 推送到 MediaMTX
    const outputUrl = `rtsp://admin:admin@127.0.0.1:8554/${streamId}`;
    const ffmpegArgs = [
        '-rtsp_transport', 'tcp',           // 使用 TCP 传输 RTSP
        '-i', rtspUrl,                       // 输入 RTSP 流
        '-c:v', 'copy',                      // 视频直接复制，不转码
        '-c:a', 'libopus',                   // 音频转码为 Opus
        '-b:a', '128k',                      // 音频码率
        '-ar', '48000',                      // 音频采样率
        '-f', 'rtsp',                        // 输出格式
        '-rtsp_transport', 'tcp',            // 输出也用 TCP
        outputUrl                             // 推送到 MediaMTX
    ];

    console.log(`[${streamId}] FFmpeg command: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
    });

    ffmpegProcess.stdout.on('data', (data) => {
        console.log(`[${streamId}] FFmpeg stdout: ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        // FFmpeg 输出很多信息到 stderr，只打印重要的
        if (msg.includes('Error') || msg.includes('error') || msg.includes('Opening') || msg.includes('Stream')) {
            console.log(`[${streamId}] FFmpeg: ${msg.trim()}`);
        }
    });

    ffmpegProcess.on('error', (err) => {
        console.error(`[${streamId}] FFmpeg process error:`, err);
    });

    ffmpegProcess.on('exit', (code, signal) => {
        console.log(`[${streamId}] FFmpeg exited with code ${code}, signal ${signal}`);
        // 如果进程异常退出，从 streams 中移除
        if (streams.has(streamId)) {
            const stream = streams.get(streamId);
            if (stream.ffmpegProcess === ffmpegProcess) {
                streams.delete(streamId);
            }
        }
    });

    const streamInfo = {
        id: streamId,
        rtspUrl,
        hlsUrl: `/hls/${streamId}/index.m3u8`,
        webrtcUrl: `/whep/${streamId}`,
        status: 'running',
        startTime: new Date(),
        ffmpegProcess  // 保存进程引用以便后续停止
    };

    streams.set(streamId, streamInfo);
    console.log(`[${streamId}] FFmpeg transcoding started`);

    return streamInfo;
}

/**
 * 停止 FFmpeg 转码流
 */
async function stopTranscoding(streamId) {
    console.log(`[${streamId}] Stopping FFmpeg transcoding`);

    const stream = streams.get(streamId);
    if (!stream) {
        console.log(`[${streamId}] Stream not found`);
        return false;
    }

    // 杀死 FFmpeg 进程
    if (stream.ffmpegProcess) {
        try {
            stream.ffmpegProcess.kill('SIGTERM');
            console.log(`[${streamId}] FFmpeg process killed`);
        } catch (err) {
            console.error(`[${streamId}] Error killing FFmpeg:`, err);
        }
    }

    streams.delete(streamId);
    return true;
}

// ===== 代理配置 =====

// WebRTC (WHEP) 代理到 MediaMTX
// 前端: /whep/streamId -> MediaMTX: /streamId/whep
app.use('/whep', createProxyMiddleware({
    target: 'http://127.0.0.1:8889',
    changeOrigin: true,
    headers: {
        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
    },
    pathRewrite: (path, req) => {
        // path 已经是 /streamId (因为路由匹配 /whep 后剩余的部分)
        // 需要转成 /streamId/whep
        const streamId = path.replace(/^\//, ''); // 移除开头的斜杠
        const newPath = `/${streamId}/whep`;
        console.log(`WHEP path rewrite: ${path} -> ${newPath}`);
        return newPath;
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[WHEP Proxy] Request to: ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
        console.log(`[WHEP Proxy] Method: ${proxyReq.method}`);
        // 强制再次设置 header，以防万一
        const auth = Buffer.from('admin:admin').toString('base64');
        proxyReq.setHeader('Authorization', `Basic ${auth}`);
        console.log(`[WHEP Proxy] Set Authorization header: Basic ${auth}`);
    },
    onError: (err, req, res) => {
        console.error('WHEP proxy error:', err);
        res.status(502).json({ error: 'WebRTC proxy error' });
    }
}));

// HLS 代理到 MediaMTX（或直接从文件系统提供）
app.use('/hls', createProxyMiddleware({
    target: 'http://127.0.0.1:8888',
    changeOrigin: true,
    pathRewrite: { '^/hls': '' },
    onProxyReq: (proxyReq, req, res) => {
        // 添加 MediaMTX Basic Auth
        const auth = Buffer.from('admin:admin').toString('base64');
        proxyReq.setHeader('Authorization', `Basic ${auth}`);
    },
    onError: (err, req, res) => {
        console.error('HLS proxy error:', err);
        res.status(502).json({ error: 'HLS proxy error' });
    }
}));

// ===== API 路由 =====

// 获取所有流
app.get('/api/streams', (req, res) => {
    const streamList = Array.from(streams.values()).map(s => ({
        id: s.id,
        rtspUrl: s.rtspUrl,
        hlsUrl: s.hlsUrl,
        webrtcUrl: s.webrtcUrl,
        status: s.status,
        startTime: s.startTime
    }));
    res.json(streamList);
});

// 添加新流
app.post('/api/streams', async (req, res) => {
    const { id, rtspUrl } = req.body;

    if (!id || !rtspUrl) {
        return res.status(400).json({ error: 'Missing id or rtspUrl' });
    }

    if (streams.has(id)) {
        return res.json({ message: 'Stream already exists', id });
    }

    try {
        const stream = await startTranscoding(id, rtspUrl);
        res.json({
            id: stream.id,
            rtspUrl: stream.rtspUrl,
            hlsUrl: stream.hlsUrl,
            webrtcUrl: stream.webrtcUrl,
            status: stream.status
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 删除流
app.delete('/api/streams/:id', async (req, res) => {
    const { id } = req.params;

    if (await stopTranscoding(id)) {
        res.json({ message: 'Stream stopped' });
    } else {
        res.status(404).json({ error: 'Stream not found' });
    }
});

// 重启流 (MediaMTX 不需要重启，重新添加即可)
app.post('/api/streams/:id/restart', async (req, res) => {
    const { id } = req.params;
    const stream = streams.get(id);

    if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
    }

    const rtspUrl = stream.rtspUrl;
    await stopTranscoding(id);

    setTimeout(async () => {
        try {
            const newStream = await startTranscoding(id, rtspUrl);
            res.json({
                id: newStream.id,
                rtspUrl: newStream.rtspUrl,
                hlsUrl: newStream.hlsUrl,
                webrtcUrl: newStream.webrtcUrl,
                status: newStream.status
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }, 1000);
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', streams: streams.size });
});

// 系统状态 API
import os from 'os';
import { exec } from 'child_process';

// 获取 CPU 使用率（通过计算两次采样的差值）
let lastCpuInfo = null;
function getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;

    for (const cpu of cpus) {
        for (const type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    }

    const currentInfo = { idle: totalIdle / cpus.length, total: totalTick / cpus.length };

    if (!lastCpuInfo) {
        lastCpuInfo = currentInfo;
        return 0;
    }

    const idleDiff = currentInfo.idle - lastCpuInfo.idle;
    const totalDiff = currentInfo.total - lastCpuInfo.total;
    const usage = 100 - Math.round(100 * idleDiff / totalDiff);

    lastCpuInfo = currentInfo;
    return Math.max(0, Math.min(100, usage));
}

// 获取磁盘使用情况（Windows）- 读取应用程序所在的盘
function getDiskUsage() {
    // 获取应用程序所在的盘符
    const appDrive = __dirname.charAt(0).toUpperCase();

    return new Promise((resolve) => {
        exec(`wmic logicaldisk where "DeviceID='${appDrive}:'" get Size,FreeSpace /format:csv`, (error, stdout) => {
            if (error) {
                console.error('Failed to get disk usage:', error);
                resolve({ used: 0, total: 0, usedPercent: 0 });
                return;
            }

            try {
                const lines = stdout.trim().split('\n').filter(line => line.trim());
                if (lines.length >= 2) {
                    const values = lines[1].split(',');
                    const freeSpace = parseInt(values[1]) || 0;
                    const totalSize = parseInt(values[2]) || 0;
                    const usedSpace = totalSize - freeSpace;

                    resolve({
                        used: Math.round(usedSpace / (1024 * 1024 * 1024)), // GB
                        total: Math.round(totalSize / (1024 * 1024 * 1024)), // GB
                        usedPercent: totalSize > 0 ? Math.round((usedSpace / totalSize) * 100) : 0
                    });
                } else {
                    resolve({ used: 0, total: 0, usedPercent: 0 });
                }
            } catch (e) {
                console.error('Failed to parse disk usage:', e);
                resolve({ used: 0, total: 0, usedPercent: 0 });
            }
        });
    });
}

app.get('/api/system-stats', async (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const cpuUsage = getCpuUsage();
    const diskUsage = await getDiskUsage();

    res.json({
        cpu: cpuUsage,
        memory: {
            used: Math.round(usedMem / (1024 * 1024 * 1024)), // GB
            total: Math.round(totalMem / (1024 * 1024 * 1024)), // GB
            usedPercent: Math.round((usedMem / totalMem) * 100)
        },
        disk: diskUsage,
        uptime: os.uptime()
    });
});

// ===== 静态文件服务（前端） =====
// 在 Electron 环境下，前端构建产物通常在 dist 目录
const FRONTEND_BUILD_DIR = path.join(__dirname, '../../dist');
console.log(`Static files directory: ${FRONTEND_BUILD_DIR}`);
app.use(express.static(FRONTEND_BUILD_DIR));

// SPA 路由支持 - 所有未匹配的请求返回 index.html
// Express 5 requires named parameters for wildcards
app.get('{*splat}', (req, res) => {
    res.sendFile(path.join(FRONTEND_BUILD_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;

export function startServer(port = PORT) {
    return new Promise((resolve, reject) => {
        try {
            const server = app.listen(port, '0.0.0.0', () => {
                const address = server.address();
                const actualPort = typeof address === 'string' ? port : address.port;
                console.log(`Server running on port ${actualPort}`);
                console.log(`MediaMTX API: ${MEDIAMTX_API}`);
                console.log(`Static files: ${FRONTEND_BUILD_DIR}`);
                resolve({ server, port: actualPort });
            });
            server.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

// 如果直接运行脚本（不是被导入），则启动服务器
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    startServer();
}
