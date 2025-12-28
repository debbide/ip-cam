import express from 'express';
import cors from 'cors';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();

// 允许所有跨域请求
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 静态文件服务（后端管理界面）
const __dirname = path.dirname(new URL(import.meta.url).pathname);
// Windows 路径修复
const publicPath = process.platform === 'win32'
    ? path.join(__dirname.substring(1), '..', 'public')
    : path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// 存储活跃的流
const streams = new Map();

// 持久化配置文件路径
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const CAMERAS_FILE = path.join(DATA_DIR, 'cameras.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MEDIAMTX_CONFIG_FILE = '/etc/mediamtx.yml';

const MEDIAMTX_API = process.env.MEDIAMTX_API || 'http://127.0.0.1:9997';

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'ip-cam-secret-key-2024';

// 默认设置
const DEFAULT_SETTINGS = {
    streamAuth: {
        enabled: false,
        password: 'password' // 默认观看密码
    },
    // 内部/推流密码（默认 admin:admin）
    publishAuth: {
        user: 'admin',
        password: 'admin'
    },
    // API 认证
    apiAuth: {
        enabled: false,
        password: '' // API 访问密码
    }
};

let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * JWT 验证中间件
 */
function authMiddleware(req, res, next) {
    // 如果 API 认证未启用，直接放行
    if (!currentSettings.apiAuth.enabled) {
        return next();
    }

    // 后端管理界面（同源请求）不需要认证
    const referer = req.headers.referer || '';
    const host = req.headers.host || '';
    if (referer.includes(host) || referer.includes('localhost') || referer.includes('127.0.0.1')) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未授权' });
    }

    const token = authHeader.substring(7);
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token 无效或已过期' });
    }
}

/**
 * 加载设置
 */
function loadSettings() {
    try {
        ensureDataDir();
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            const savedSettings = JSON.parse(data);
            currentSettings = {
                ...DEFAULT_SETTINGS,
                ...savedSettings,
                streamAuth: { ...DEFAULT_SETTINGS.streamAuth, ...savedSettings.streamAuth },
                publishAuth: { ...DEFAULT_SETTINGS.publishAuth, ...savedSettings.publishAuth },
                apiAuth: { ...DEFAULT_SETTINGS.apiAuth, ...savedSettings.apiAuth }
            };
            console.log('Loaded settings:', currentSettings);
        } else {
            saveSettings();
        }
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

/**
 * 保存设置
 */
function saveSettings() {
    try {
        ensureDataDir();
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2));
        console.log('Saved settings to', SETTINGS_FILE);
    } catch (err) {
        console.error('Failed to save settings:', err);
    }
}

// ==================== 用户管理 ====================

// 默认管理员账户
const DEFAULT_ADMIN = {
    username: 'admin',
    password: 'Admin@123',
    isAdmin: true
};

// 内存中的用户列表
let users = [];

/**
 * 密码哈希
 */
function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'ip-cam-salt-2024').digest('hex');
}

/**
 * 加载用户列表
 */
function loadUsers() {
    try {
        ensureDataDir();
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf-8');
            users = JSON.parse(data);
            console.log(`Loaded ${users.length} users from ${USERS_FILE}`);
        } else {
            // 首次启动，用户列表为空，第一个注册的用户将成为管理员
            users = [];
            console.log('No users found, first registered user will be admin');
        }
    } catch (err) {
        console.error('Failed to load users:', err);
        users = [];
    }
}

/**
 * 保存用户列表
 */
function saveUsers() {
    try {
        ensureDataDir();
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log(`Saved ${users.length} users to ${USERS_FILE}`);
    } catch (err) {
        console.error('Failed to save users:', err);
    }
}

/**
 * 验证密码强度
 */
function validatePassword(password) {
    const errors = [];
    if (password.length < 8) errors.push('密码长度至少8位');
    if (!/[A-Z]/.test(password)) errors.push('需要包含大写字母');
    if (!/[a-z]/.test(password)) errors.push('需要包含小写字母');
    if (!/[0-9]/.test(password)) errors.push('需要包含数字');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('需要包含特殊字符');
    return { valid: errors.length === 0, errors };
}

// 初始化加载
loadSettings();
loadUsers();

/**
 * 更新 MediaMTX 配置文件
 */
function updateMediaMtxConfig() {
    try {
        if (!fs.existsSync(MEDIAMTX_CONFIG_FILE)) {
            console.error('MediaMTX config file not found:', MEDIAMTX_CONFIG_FILE);
            return;
        }

        let config = fs.readFileSync(MEDIAMTX_CONFIG_FILE, 'utf-8');
        const viewEnabled = currentSettings.streamAuth.enabled;
        const viewPassword = currentSettings.streamAuth.password || 'password';
        const adminUser = currentSettings.publishAuth.user || 'admin';
        const adminPass = currentSettings.publishAuth.password || 'admin';

        // 构建新的认证部分
        let newAuthSection = 'authInternalUsers:\n';

        // 1. Admin 用户 (用于推流、API、内部 ffmpeg) - 始终存在且拥有所有权限
        newAuthSection += `  # 管理员/推流用户
  - user: ${adminUser}
    pass: "${adminPass}"
    permissions:
      - action: api
      - action: read
      - action: publish
        path: ''
      - action: playback\n`;

        // 2. 观看用户 (Viewer) 或 匿名
        if (!viewEnabled) {
            // 未启用加密：添加匿名用户，允许读取/播放
            newAuthSection += `  # 匿名用户 - 允许公开观看
  - user: ""
    pass: ""
    permissions:
      - action: read
      - action: playback`;
        } else {
            // 启用加密：添加 viewer 用户
            newAuthSection += `  # 观看用户 - 仅允许播放
  - user: viewer
    pass: "${viewPassword}"
    permissions:
      - action: read
      - action: playback`;
        }

        // 使用正则替换 authInternalUsers 部分
        const regex = /authInternalUsers:[\s\S]*?(?=\n#+|$)/;

        if (regex.test(config)) {
            config = config.replace(regex, newAuthSection + '\n\n');
        } else {
            console.warn('Could not find authInternalUsers section, appending...');
            config += '\n' + newAuthSection;
        }

        fs.writeFileSync(MEDIAMTX_CONFIG_FILE, config);
        console.log('Updated MediaMTX config. Reloading...');

        // 重载 MediaMTX 配置
        exec('pkill -HUP mediamtx', (err) => {
            if (err) console.error('Failed to reload MediaMTX:', err);
            else console.log('MediaMTX reloaded successfully');
        });

    } catch (err) {
        console.error('Failed to update MediaMTX config:', err);
    }
}

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log(`Created data directory: ${DATA_DIR}`);
    }
}

/**
 * 从文件加载摄像头配置
 */
function loadCameras() {
    try {
        ensureDataDir();
        if (fs.existsSync(CAMERAS_FILE)) {
            const data = fs.readFileSync(CAMERAS_FILE, 'utf-8');
            const cameras = JSON.parse(data);
            console.log(`Loaded ${cameras.length} cameras from ${CAMERAS_FILE}`);
            return cameras;
        }
    } catch (err) {
        console.error('Failed to load cameras:', err);
    }
    return [];
}

/**
 * 保存摄像头配置到文件
 */
function saveCameras() {
    try {
        ensureDataDir();
        const cameras = Array.from(streams.values()).map(s => ({
            id: s.id,
            name: s.name,
            rtspUrl: s.rtspUrl
        }));
        fs.writeFileSync(CAMERAS_FILE, JSON.stringify(cameras, null, 2));
        console.log(`Saved ${cameras.length} cameras to ${CAMERAS_FILE}`);
    } catch (err) {
        console.error('Failed to save cameras:', err);
    }
}

/**
 * 获取 MediaMTX API 认证头 (使用 Admin 账号)
 */
function getMediaMtxAuthHeader() {
    const user = currentSettings.publishAuth.user || 'admin';
    const pass = currentSettings.publishAuth.password || 'admin';
    return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

/**
 * 注册流到 MediaMTX
 */
async function startStream(streamId, rtspUrl, name = '') {
    console.log(`[${streamId}] Registering stream with MediaMTX: ${rtspUrl}`);

    try {
        const authHeader = getMediaMtxAuthHeader();
        // 内部 ffmpeg 使用 Admin 账号连接
        const adminUser = currentSettings.publishAuth.user || 'admin';
        const adminPass = currentSettings.publishAuth.password || 'admin';

        // 1. 注册原始流
        const rawStreamId = `${streamId}_raw`;
        await fetch(`${MEDIAMTX_API}/v3/config/paths/add/${rawStreamId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                source: rtspUrl,
                sourceOnDemand: false,
            })
        });

        // 2. 注册转码流
        // ffmpeg 拉取 rawStreamId (本地) 和 推送 streamId (本地) 都使用 Admin 账号
        const ffmpegInput = `rtsp://${adminUser}:${adminPass}@127.0.0.1:8554/${rawStreamId}`;
        const ffmpegOutput = `rtsp://${adminUser}:${adminPass}@127.0.0.1:8554/${streamId}`;

        const response = await fetch(`${MEDIAMTX_API}/v3/config/paths/add/${streamId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                source: 'publisher',
                runOnDemand: `ffmpeg -hide_banner -loglevel error -rtsp_transport tcp -i ${ffmpegInput} -c:v copy -c:a libopus -f rtsp ${ffmpegOutput}`,
                runOnDemandRestart: true,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`MediaMTX API error: ${response.status} ${errorText}`);
        }

        console.log(`[${streamId}] Stream registered successfully`);

        const streamInfo = {
            id: streamId,
            name: name || streamId,
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
        const authHeader = getMediaMtxAuthHeader();

        // 1. 删除原始流路径
        const rawStreamId = `${streamId}_raw`;
        await fetch(`${MEDIAMTX_API}/v3/config/paths/delete/${rawStreamId}`, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader }
        });

        // 2. 删除主路径
        const response = await fetch(`${MEDIAMTX_API}/v3/config/paths/delete/${streamId}`, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader }
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

// ==================== 用户认证 API ====================

// 用户登录
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }

    const hash = hashPassword(password);
    if (hash !== user.passwordHash) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
        { username: user.username, isAdmin: user.isAdmin },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({
        token,
        user: {
            username: user.username,
            isAdmin: user.isAdmin
        }
    });
});

// 获取当前用户信息
app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未登录' });
    }

    try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = users.find(u => u.username === decoded.username);
        if (!user) {
            return res.status(401).json({ error: '用户不存在' });
        }
        res.json({
            username: user.username,
            isAdmin: user.isAdmin
        });
    } catch (err) {
        return res.status(401).json({ error: 'Token 无效或已过期' });
    }
});

// 检查是否有用户
app.get('/api/auth/has-users', (req, res) => {
    res.json({ hasUsers: users.length > 0 });
});

// 用户注册（首个用户自动成为管理员）
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || username.length < 3) {
        return res.status(400).json({ error: '用户名至少3个字符' });
    }

    if (users.some(u => u.username === username)) {
        return res.status(400).json({ error: '用户名已存在' });
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join('\n') });
    }

    // 首个用户自动成为管理员
    const isFirstUser = users.length === 0;
    const newUser = {
        username,
        passwordHash: hashPassword(password),
        isAdmin: isFirstUser,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers();

    // 注册成功后自动登录
    const token = jwt.sign(
        { username: newUser.username, isAdmin: newUser.isAdmin },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({
        token,
        user: {
            username: newUser.username,
            isAdmin: newUser.isAdmin
        },
        message: isFirstUser ? '管理员账户创建成功' : '用户创建成功'
    });
});

// ==================== 用户管理 API (管理员专用) ====================

// 管理员验证中间件
function adminMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未登录' });
    }

    try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.isAdmin) {
            return res.status(403).json({ error: '需要管理员权限' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token 无效或已过期' });
    }
}

// 获取用户列表
app.get('/api/users', adminMiddleware, (req, res) => {
    const userList = users.map(u => ({
        username: u.username,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt
    }));
    res.json(userList);
});

// 创建用户
app.post('/api/users', adminMiddleware, (req, res) => {
    const { username, password, isAdmin } = req.body;

    if (!username || username.length < 3) {
        return res.status(400).json({ error: '用户名至少3个字符' });
    }

    if (users.some(u => u.username === username)) {
        return res.status(400).json({ error: '用户名已存在' });
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join('\n') });
    }

    const newUser = {
        username,
        passwordHash: hashPassword(password),
        isAdmin: !!isAdmin,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers();

    res.json({
        username: newUser.username,
        isAdmin: newUser.isAdmin,
        createdAt: newUser.createdAt
    });
});

// 删除用户
app.delete('/api/users/:username', adminMiddleware, (req, res) => {
    const { username } = req.params;

    // 不能删除自己
    if (req.user.username === username) {
        return res.status(400).json({ error: '不能删除当前登录用户' });
    }

    // 确保至少保留一个管理员
    const admins = users.filter(u => u.isAdmin);
    const targetUser = users.find(u => u.username === username);

    if (!targetUser) {
        return res.status(404).json({ error: '用户不存在' });
    }

    if (targetUser.isAdmin && admins.length <= 1) {
        return res.status(400).json({ error: '至少需要保留一个管理员' });
    }

    users = users.filter(u => u.username !== username);
    saveUsers();

    res.json({ message: '用户已删除' });
});



// 旧版 API 登录接口（兼容）
app.post('/api/login', (req, res) => {
    const { password } = req.body;

    if (!currentSettings.apiAuth.enabled) {
        return res.json({ message: 'Auth not required' });
    }

    if (password !== currentSettings.apiAuth.password) {
        return res.status(401).json({ error: '密码错误' });
    }

    const token = jwt.sign({ type: 'api' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
});

// 获取所有流 (需要认证)
app.get('/api/streams', authMiddleware, (req, res) => {
    const streamList = Array.from(streams.values()).map(s => ({
        id: s.id,
        name: s.name,
        rtspUrl: s.rtspUrl,
        status: s.status,
        startTime: s.startTime
    }));
    res.json(streamList);
});

// 添加新流 (需要认证)
app.post('/api/streams', authMiddleware, async (req, res) => {
    const { id, name, rtspUrl } = req.body;

    if (!id || !rtspUrl) {
        return res.status(400).json({ error: 'Missing id or rtspUrl' });
    }

    if (streams.has(id)) {
        return res.json({ message: 'Stream already exists', id });
    }

    try {
        const stream = await startStream(id, rtspUrl, name);
        saveCameras();
        res.json({
            id: stream.id,
            name: stream.name,
            rtspUrl: stream.rtspUrl,
            status: stream.status
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 删除流 (需要认证)
app.delete('/api/streams/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;

    if (await stopStream(id)) {
        saveCameras();
        res.json({ message: 'Stream stopped' });
    } else {
        res.status(404).json({ error: 'Stream not found' });
    }
});

// 获取设置
app.get('/api/settings', (req, res) => {
    res.json({
        streamAuth: {
            enabled: currentSettings.streamAuth.enabled,
            password: currentSettings.streamAuth.password
        },
        apiAuth: {
            enabled: currentSettings.apiAuth.enabled
            // 注意：不返回密码
        }
    });
});

// 更新设置 (需要认证)
app.post('/api/settings', authMiddleware, async (req, res) => {
    const newSettings = req.body;

    // 更新 API 认证设置
    if (newSettings.apiAuth) {
        if (typeof newSettings.apiAuth.enabled === 'boolean') {
            currentSettings.apiAuth.enabled = newSettings.apiAuth.enabled;
        }
        if (newSettings.apiAuth.password !== undefined) {
            currentSettings.apiAuth.password = newSettings.apiAuth.password;
        }
        saveSettings();
    }

    // 更新流认证设置
    if (newSettings.streamAuth) {
        if (typeof newSettings.streamAuth.enabled === 'boolean') {
            currentSettings.streamAuth.enabled = newSettings.streamAuth.enabled;
        }
        if (newSettings.streamAuth.password !== undefined) {
            currentSettings.streamAuth.password = newSettings.streamAuth.password || 'password';
        }

        // 保存并应用配置
        saveSettings();
        updateMediaMtxConfig();

        // 等待 MediaMTX 重载
        console.log('Settings updated. Restarting all streams to apply new auth...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 重启所有流
        const cameras = loadCameras();
        for (const camera of cameras) {
            if (streams.has(camera.id)) {
                await stopStream(camera.id);
            }
            try {
                await startStream(camera.id, camera.rtspUrl, camera.name);
                console.log(`[${camera.id}] Stream restarted with new auth settings`);
            } catch (err) {
                console.error(`[${camera.id}] Failed to restart stream:`, err);
            }
        }
    }

    res.json(currentSettings);
});

// 重启流
app.post('/api/streams/:id/restart', async (req, res) => {
    const { id } = req.params;
    const stream = streams.get(id);

    if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
    }

    const { rtspUrl, name } = stream;
    await stopStream(id);

    setTimeout(async () => {
        try {
            const newStream = await startStream(id, rtspUrl, name);
            res.json({
                id: newStream.id,
                name: newStream.name,
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

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        streams: streams.size,
        uptime: os.uptime()
    });
});

app.get('/api/server-info', (req, res) => {
    res.json({
        name: 'IP Cam Backend',
        version: '1.0.0',
        authRequired: currentSettings.apiAuth.enabled, // API 认证状态
        streamAuthEnabled: currentSettings.streamAuth.enabled, // 流认证状态
        streams: streams.size,
        ports: {
            api: parseInt(process.env.PORT) || 3001,
            rtsp: parseInt(process.env.RTSP_PORT) || 8554,
            hls: parseInt(process.env.HLS_PORT) || 8888,
            webrtc: parseInt(process.env.WEBRTC_PORT) || 8889
        }
    });
});

const PORT = process.env.PORT || 3001;

async function restoreCameras() {
    const cameras = loadCameras();
    console.log(`Restoring ${cameras.length} cameras...`);

    // 确保 MediaMTX 配置已同步
    updateMediaMtxConfig();

    // 等待 MediaMTX 重载完成
    console.log('Waiting for MediaMTX to reload...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    for (const camera of cameras) {
        try {
            await startStream(camera.id, camera.rtspUrl, camera.name);
            console.log(`[${camera.id}] Restored successfully`);
        } catch (err) {
            console.error(`[${camera.id}] Failed to restore:`, err.message);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Restoration complete. Active streams: ${streams.size}`);
}

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`=================================`);
    console.log(`IP Cam Backend API Server`);
    console.log(`=================================`);
    console.log(`API Port: ${PORT}`);
    console.log(`MediaMTX API: ${MEDIAMTX_API}`);
    console.log(`Data Directory: ${DATA_DIR}`);
    console.log(`=================================`);

    await restoreCameras();
});
