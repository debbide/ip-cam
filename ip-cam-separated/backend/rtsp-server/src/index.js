import express from 'express';
import cors from 'cors';
import os from 'os';
import { exec } from 'child_process';

const app = express();

// 允许所有跨域请求
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 存储活跃的流
const streams = new Map();

const MEDIAMTX_API = process.env.MEDIAMTX_API || 'http://127.0.0.1:9997';

/**
 * 注册流到 MediaMTX
 */
async function startStream(streamId, rtspUrl) {
    console.log(`[${streamId}] Registering stream with MediaMTX: ${rtspUrl}`);

    try {
        const response = await fetch(`${MEDIAMTX_API}/v3/config/paths/add/${streamId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
            },
            body: JSON.stringify({
                source: rtspUrl,
                sourceOnDemand: false,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`MediaMTX API error: ${response.status} ${errorText}`);
        }

        console.log(`[${streamId}] Stream registered successfully`);

        const streamInfo = {
            id: streamId,
            rtspUrl,
            status: 'running',
            startTime: new Date()
        };

        streams.set(streamId, streamInfo);
        return streamInfo;
    } catch (err) {
        console.error(`[${streamId}] Failed to register stream:`, err);
        throw err;
    }
}

/**
 * 从 MediaMTX 移除流
 */
async function stopStream(streamId) {
    console.log(`[${streamId}] Removing stream from MediaMTX`);

    try {
        const response = await fetch(`${MEDIAMTX_API}/v3/config/paths/delete/${streamId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
            }
        });

        if (!response.ok && response.status !== 404) {
            console.error(`[${streamId}] Failed to delete path: ${response.status}`);
        }

        streams.delete(streamId);
        return true;
    } catch (err) {
        console.error(`[${streamId}] Error removing stream:`, err);
        return false;
    }
}

// ==================== API 路由 ====================

// 获取所有流
app.get('/api/streams', (req, res) => {
    const streamList = Array.from(streams.values()).map(s => ({
        id: s.id,
        rtspUrl: s.rtspUrl,
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
        const stream = await startStream(id, rtspUrl);
        res.json({
            id: stream.id,
            rtspUrl: stream.rtspUrl,
            status: stream.status
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 删除流
app.delete('/api/streams/:id', async (req, res) => {
    const { id } = req.params;

    if (await stopStream(id)) {
        res.json({ message: 'Stream stopped' });
    } else {
        res.status(404).json({ error: 'Stream not found' });
    }
});

// 重启流
app.post('/api/streams/:id/restart', async (req, res) => {
    const { id } = req.params;
    const stream = streams.get(id);

    if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
    }

    const rtspUrl = stream.rtspUrl;
    await stopStream(id);

    setTimeout(async () => {
        try {
            const newStream = await startStream(id, rtspUrl);
            res.json({
                id: newStream.id,
                rtspUrl: newStream.rtspUrl,
                status: newStream.status
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }, 1000);
});

// ==================== 系统统计 ====================

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
    const usage = 100 - (idleDiff / totalDiff) * 100;

    lastCpuInfo = currentInfo;
    return Math.round(usage);
}

function getDiskUsage() {
    return new Promise((resolve) => {
        // Linux 环境
        exec('df -k / | tail -1', (err, stdout) => {
            if (err) {
                resolve({ used: 0, total: 0, usedPercent: 0 });
                return;
            }
            const parts = stdout.trim().split(/\s+/);
            if (parts.length >= 5) {
                const total = parseInt(parts[1]) / (1024 * 1024); // GB
                const used = parseInt(parts[2]) / (1024 * 1024);  // GB
                const usedPercent = parseInt(parts[4].replace('%', ''));
                resolve({
                    used: Math.round(used),
                    total: Math.round(total),
                    usedPercent
                });
            } else {
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
            used: Math.round(usedMem / (1024 * 1024 * 1024)),
            total: Math.round(totalMem / (1024 * 1024 * 1024)),
            usedPercent: Math.round((usedMem / totalMem) * 100)
        },
        disk: diskUsage,
        uptime: os.uptime(),
        streams: streams.size
    });
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        streams: streams.size,
        uptime: os.uptime()
    });
});

// 服务器信息（用于客户端验证连接）
app.get('/api/server-info', (req, res) => {
    res.json({
        name: 'IP Cam Backend',
        version: '1.0.0',
        streams: streams.size,
        ports: {
            api: parseInt(process.env.PORT) || 3001,
            rtsp: 8554,
            hls: 8888,
            webrtc: 8889
        }
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`IP Cam Backend API Server`);
    console.log(`=================================`);
    console.log(`API Port: ${PORT}`);
    console.log(`MediaMTX API: ${MEDIAMTX_API}`);
    console.log(`=================================`);
});
