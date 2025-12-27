import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// 存储活跃的转码进程
const streams = new Map();

const MEDIAMTX_API = process.env.MEDIAMTX_API || 'http://mediamtx:9997';

/**
 * 启动 MediaMTX 流
 */
async function startTranscoding(streamId, rtspUrl) {
    console.log(`[${streamId}] Registering stream with MediaMTX: ${rtspUrl}`);

    try {
        // 调用 MediaMTX API 添加路径
        const response = await fetch(`${MEDIAMTX_API}/v3/config/paths/add/${streamId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
            },
            body: JSON.stringify({
                source: rtspUrl,
                sourceOnDemand: false, // 始终保持连接，减少首屏延迟
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`MediaMTX API error: ${response.status} ${errorText}`);
        }

        console.log(`[${streamId}] Stream registered successfully`);

        streams.set(streamId, {
            id: streamId,
            rtspUrl,
            hlsUrl: `http://localhost:8888/${streamId}/index.m3u8`, // MediaMTX HLS
            webrtcUrl: `http://localhost:8889/${streamId}`, // MediaMTX WebRTC (WHEP)
            status: 'running',
            startTime: new Date()
        });

        return streams.get(streamId);
    } catch (err) {
        console.error(`[${streamId}] Failed to register stream:`, err);
        throw err;
    }
}

/**
 * 停止 MediaMTX 流
 */
async function stopTranscoding(streamId) {
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

// API 路由

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`RTSP Server running on port ${PORT}`);
    console.log(`MediaMTX API: ${MEDIAMTX_API}`);
});
