import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { startServer } from '../rtsp-server/src/index.simple.js';
import net from 'net';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix for portable mode persistence
// electron-builder portable sets PORTABLE_EXECUTABLE_DIR
if (process.env.PORTABLE_EXECUTABLE_DIR) {
    const portableDataPath = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data');
    if (!fs.existsSync(portableDataPath)) {
        fs.mkdirSync(portableDataPath, { recursive: true });
    }
    app.setPath('userData', portableDataPath);
}

// Setup File Logging
const LOG_FILE = path.join(app.getPath('userData'), 'app.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    try {
        logStream.write(logMessage);
        // Also write to console for dev
        if (process.stdout.writable) process.stdout.write(logMessage);
    } catch (e) {
        // Ignore logging errors
    }
}

// Override console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
    logToFile(args.map(a => String(a)).join(' '));
    // originalConsoleLog(...args); // Optional: keep original behavior
};

console.error = (...args) => {
    logToFile('[ERROR] ' + args.map(a => String(a)).join(' '));
    // originalConsoleError(...args);
};

// Global Error Handlers
process.on('uncaughtException', (error) => {
    logToFile(`Uncaught Exception: ${error.stack || error}`);
    dialog.showErrorBox('Critical Error', `Uncaught Exception:\n${error.message}\n\nCheck logs at: ${LOG_FILE}`);
    // app.quit(); // Optional: let it try to continue or crash
});

process.on('unhandledRejection', (reason, promise) => {
    logToFile(`Unhandled Rejection: ${reason}`);
    // dialog.showErrorBox('Unhandled Rejection', `Promise Rejection:\n${reason}`);
});

logToFile('----------------------------------------');
logToFile(`App Starting... Version: ${app.getVersion()}`);
logToFile(`User Data Path: ${app.getPath('userData')}`);
logToFile(`Executable Path: ${process.execPath}`);

let mainWindow;
let mediamtxProcess;

// Adjust paths based on whether we are running from source or built app
const isDev = !app.isPackaged;
const RESOURCES_PATH = isDev ? path.join(__dirname, '..') : process.resourcesPath;

logToFile(`isDev: ${isDev}`);
logToFile(`RESOURCES_PATH: ${RESOURCES_PATH}`);

// 设置环境变量，供 rtsp-server 使用
process.env.RESOURCES_PATH = RESOURCES_PATH;

const MEDIAMTX_PATH = path.join(RESOURCES_PATH, 'bin/mediamtx.exe');
// 开发环境使用 bin/mediamtx.yml，打包后使用 mediamtx.unified.yml
const MEDIAMTX_CONFIG = isDev
    ? path.join(RESOURCES_PATH, 'bin/mediamtx.yml')
    : path.join(RESOURCES_PATH, 'mediamtx.unified.yml');

logToFile(`MEDIAMTX_PATH: ${MEDIAMTX_PATH}`);
logToFile(`MEDIAMTX_CONFIG: ${MEDIAMTX_CONFIG}`);

// 配置文件路径
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

// 读取配置
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        }
    } catch (e) {
        console.error('Failed to load config:', e);
    }
    return { savePath: app.getPath('downloads') };
}

// 保存配置
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('Failed to save config:', e);
    }
}

// ===== Persistent Store for Frontend Data =====
// This replaces localStorage for portable mode persistence
const STORE_PATH = path.join(app.getPath('userData'), 'store.json');

function loadStore() {
    try {
        if (fs.existsSync(STORE_PATH)) {
            return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
        }
    } catch (e) {
        console.error('Failed to load store:', e);
    }
    return {};
}

function saveStore(store) {
    try {
        fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
    } catch (e) {
        console.error('Failed to save store:', e);
    }
}

// IPC handlers for store
ipcMain.handle('store-get', (event, key) => {
    const store = loadStore();
    return store[key] ?? null;
});

ipcMain.handle('store-set', (event, key, value) => {
    const store = loadStore();
    store[key] = value;
    saveStore(store);
    return true;
});

ipcMain.handle('store-remove', (event, key) => {
    const store = loadStore();
    delete store[key];
    saveStore(store);
    return true;
});


// 确保保存目录存在
function ensureSaveDirectory() {
    const config = loadConfig();
    if (!fs.existsSync(config.savePath)) {
        fs.mkdirSync(config.savePath, { recursive: true });
    }
    return config.savePath;
}

// IPC Handlers
// 递归计算文件夹大小
function calculateFolderSize(directoryPath) {
    let totalSize = 0;
    try {
        const files = fs.readdirSync(directoryPath);
        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                totalSize += calculateFolderSize(filePath);
            } else {
                totalSize += stats.size;
            }
        }
    } catch (e) {
        console.error('Error calculating folder size:', e);
    }
    return totalSize;
}

// 管理存储配额
async function manageStorageQuota() {
    const config = loadConfig();
    if (!config.storage || !config.storage.enabled) return;

    const maxSizeBytes = config.storage.maxSizeGB * 1024 * 1024 * 1024;
    const savePath = config.savePath;

    try {
        let currentSize = calculateFolderSize(savePath);
        console.log(`[Storage] Current size: ${(currentSize / 1024 / 1024).toFixed(2)} MB, Limit: ${config.storage.maxSizeGB} GB`);

        if (currentSize > maxSizeBytes) {
            console.log('[Storage] Quota exceeded, cleaning up old files...');

            // 获取所有录像文件
            const videoDir = path.join(savePath, '录像');
            if (fs.existsSync(videoDir)) {
                const files = fs.readdirSync(videoDir)
                    .map(file => {
                        const filePath = path.join(videoDir, file);
                        return {
                            path: filePath,
                            mtime: fs.statSync(filePath).mtime
                        };
                    })
                    .sort((a, b) => a.mtime - b.mtime); // 最旧的在前

                // 删除文件直到低于 90% 配额
                const targetSize = maxSizeBytes * 0.9;
                for (const file of files) {
                    if (currentSize <= targetSize) break;

                    try {
                        const stats = fs.statSync(file.path);
                        fs.unlinkSync(file.path);
                        currentSize -= stats.size;
                        console.log(`[Storage] Deleted old file: ${file.path}`);
                    } catch (e) {
                        console.error(`[Storage] Failed to delete file ${file.path}:`, e);
                    }
                }
            }
        }
    } catch (e) {
        console.error('[Storage] Error managing quota:', e);
    }
}

// 定期检查存储配额 (每 5 分钟)
setInterval(manageStorageQuota, 5 * 60 * 1000);

// IPC Handlers
ipcMain.handle('get-storage-stats', async () => {
    const config = loadConfig();
    const savePath = config.savePath;
    const totalSize = calculateFolderSize(savePath);

    // 获取磁盘空间信息 (简单估算，Node.js 原生不支持获取磁盘剩余空间，这里只返回已用空间)
    // 如果需要精确的磁盘剩余空间，可能需要引入 check-disk-space 库，但为了保持简单，先只做文件夹大小
    return {
        usedBytes: totalSize,
        path: savePath,
        quotaGB: config.storage?.maxSizeGB || 0,
        enabled: config.storage?.enabled || false
    };
});

ipcMain.handle('update-storage-settings', async (event, settings) => {
    const config = loadConfig();
    config.storage = settings;
    saveConfig(config);
    // 立即触发一次检查
    manageStorageQuota();
    return true;
});

// ===== 通知系统 =====
ipcMain.handle('get-notification-config', async () => {
    const config = loadConfig();
    return config.notification || {
        enabled: false,
        type: 'webhook',
        webhookUrl: '',
        telegramBotToken: '',
        telegramChatId: '',
        wecomWebhookUrl: ''
    };
});

ipcMain.handle('update-notification-config', async (event, notificationConfig) => {
    const config = loadConfig();
    config.notification = notificationConfig;
    saveConfig(config);
    return true;
});

// 获取应用日志
ipcMain.handle('get-app-logs', async () => {
    try {
        if (fs.existsSync(LOG_FILE)) {
            const content = fs.readFileSync(LOG_FILE, 'utf-8');
            // Return last 50KB to avoid huge payloads, but enough context
            const MAX_LOG_SIZE = 50 * 1024;
            if (content.length > MAX_LOG_SIZE) {
                return '...[truncated]...\n' + content.slice(-MAX_LOG_SIZE);
            }
            return content;
        }
        return 'Log file not found.';
    } catch (e) {
        return `Error reading logs: ${e.message}`;
    }
});

// 发送通知的核心函数
async function sendNotification(message, imageBase64 = null) {
    const config = loadConfig();
    const nc = config.notification;

    if (!nc || !nc.enabled) {
        return { success: false, error: '通知未启用' };
    }

    try {
        if (nc.type === 'telegram') {
            // Telegram Bot API
            const botToken = nc.telegramBotToken;
            const chatId = nc.telegramChatId;

            if (!botToken || !chatId) {
                return { success: false, error: 'Telegram 配置不完整' };
            }

            if (imageBase64) {
                // 发送图片 - 使用原生 FormData 和 Blob
                console.log('[Notification] Sending Telegram photo, image size:', imageBase64.length, 'bytes');

                const imageBuffer = Buffer.from(imageBase64, 'base64');
                const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

                const formData = new FormData();
                formData.append('chat_id', chatId);
                formData.append('caption', message);
                formData.append('photo', blob, 'alert.jpg');

                const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                    method: 'POST',
                    body: formData
                });

                console.log('[Notification] Telegram HTTP status:', response.status);
                const responseText = await response.text();
                console.log('[Notification] Telegram raw response:', responseText.substring(0, 500));

                if (!response.ok) {
                    return { success: false, error: `HTTP ${response.status}: ${responseText.substring(0, 200)}` };
                }

                try {
                    const result = JSON.parse(responseText);
                    if (!result.ok) {
                        return { success: false, error: result.description };
                    }
                } catch (parseError) {
                    console.log('[Notification] JSON parse error, but HTTP was OK');
                }
            } else {
                // 发送纯文本
                const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: message })
                });
                const result = await response.json();
                if (!result.ok) {
                    return { success: false, error: result.description };
                }
            }
            return { success: true };

        } else if (nc.type === 'wecom') {
            // 企业微信机器人
            const webhookUrl = nc.wecomWebhookUrl;
            if (!webhookUrl) {
                return { success: false, error: '企业微信 Webhook URL 未配置' };
            }

            if (imageBase64) {
                // 企业微信发送图片需要先发送文本，再发送图片
                // 先发送文本消息
                const textPayload = {
                    msgtype: 'text',
                    text: { content: message }
                };

                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(textPayload)
                });

                // 再发送图片 (base64)
                const imagePayload = {
                    msgtype: 'image',
                    image: {
                        base64: imageBase64,
                        md5: crypto.createHash('md5').update(Buffer.from(imageBase64, 'base64')).digest('hex')
                    }
                };

                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(imagePayload)
                });
                const result = await response.json();
                if (result.errcode !== 0) {
                    return { success: false, error: result.errmsg };
                }
            } else {
                // 只发送文本
                const payload = {
                    msgtype: 'text',
                    text: { content: message }
                };

                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (result.errcode !== 0) {
                    return { success: false, error: result.errmsg };
                }
            }
            return { success: true };

        } else if (nc.type === 'dingtalk') {
            // 钉钉机器人
            const webhookUrl = nc.webhookUrl;
            if (!webhookUrl) {
                return { success: false, error: '钉钉 Webhook URL 未配置' };
            }

            const payload = {
                msgtype: 'text',
                text: { content: message }
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.errcode !== 0) {
                return { success: false, error: result.errmsg };
            }
            return { success: true };

        } else {
            // 通用 Webhook
            const webhookUrl = nc.webhookUrl;
            if (!webhookUrl) {
                return { success: false, error: 'Webhook URL 未配置' };
            }

            const payload = {
                message,
                timestamp: new Date().toISOString(),
                image: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }
            return { success: true };
        }
    } catch (error) {
        console.error('[Notification] Error:', error);
        return { success: false, error: error.message };
    }
}

ipcMain.handle('send-test-notification', async () => {
    return await sendNotification('🔔 测试通知：IP Cam Streamer 报警系统已连接！');
});

ipcMain.handle('send-notification', async (event, message, imageBase64) => {
    return await sendNotification(message, imageBase64);
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: '选择保存路径'
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const config = loadConfig();
        config.savePath = result.filePaths[0];
        saveConfig(config);
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('get-save-path', () => {
    return loadConfig().savePath;
});

ipcMain.handle('set-save-path', (event, savePath) => {
    const config = loadConfig();
    config.savePath = savePath;
    saveConfig(config);
    return true;
});

ipcMain.handle('save-file', async (event, dataUrl, filename, subfolder = '') => {
    try {
        const basePath = ensureSaveDirectory();

        // 创建子文件夹（如果指定了的话）
        let targetPath = basePath;
        if (subfolder) {
            targetPath = path.join(basePath, subfolder);
            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }
        }

        const filePath = path.join(targetPath, filename);

        // Convert data URL to buffer (支持 image 和 video)
        const base64Data = dataUrl.replace(/^data:[a-z]+\/[a-z0-9+.-]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        fs.writeFileSync(filePath, buffer);
        console.log(`File saved: ${filePath}`);

        // 保存后触发一次配额检查
        manageStorageQuota();

        return { success: true, path: filePath };
    } catch (error) {
        console.error('Failed to save file:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-save-folder', async () => {
    const savePath = ensureSaveDirectory();
    shell.openPath(savePath);
    return true;
});

// 获取保存目录下的文件列表（按子目录分类）
ipcMain.handle('list-saved-files', async () => {
    try {
        const basePath = ensureSaveDirectory();
        const result = {
            截图: [],
            录像: [],
            人形检测: [],
            移动侦测: []
        };

        for (const folder of Object.keys(result)) {
            const folderPath = path.join(basePath, folder);
            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath);
                result[folder] = files.map(filename => {
                    const filePath = path.join(folderPath, filename);
                    const stats = fs.statSync(filePath);
                    return {
                        name: filename,
                        path: filePath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        folder: folder
                    };
                }).sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
            }
        }

        return { success: true, files: result };
    } catch (error) {
        console.error('Failed to list files:', error);
        return { success: false, error: error.message };
    }
});

// 删除文件
ipcMain.handle('delete-file', async (event, filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        }
        return { success: false, error: '文件不存在' };
    } catch (error) {
        console.error('Failed to delete file:', error);
        return { success: false, error: error.message };
    }
});

// 获取文件的本地 URL (file://)
ipcMain.handle('get-file-url', async (event, filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            return { success: true, url: pathToFileURL(filePath).href };
        }
        return { success: false, error: '文件不存在' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

function createWindow(port) {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false, // 允许加载本地 file:// URL
        },
        autoHideMenuBar: true,
    });

    mainWindow.loadURL(`http://localhost:${port}`);
    // if (isDev) {
    //     mainWindow.webContents.openDevTools();
    // }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

async function startApp() {
    // Start MediaMTX
    logToFile(`Starting MediaMTX from ${MEDIAMTX_PATH}`);
    logToFile(`Config: ${MEDIAMTX_CONFIG}`);

    if (fs.existsSync(MEDIAMTX_PATH)) {
        mediamtxProcess = spawn(MEDIAMTX_PATH, [MEDIAMTX_CONFIG], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });

        mediamtxProcess.stdout.on('data', (data) => {
            logToFile(`[MediaMTX] ${data.toString().trim()}`);
        });

        mediamtxProcess.stderr.on('data', (data) => {
            logToFile(`[MediaMTX Error] ${data.toString().trim()}`);
        });

        mediamtxProcess.on('error', (err) => {
            logToFile(`Failed to start MediaMTX: ${err.message}`);
            dialog.showErrorBox('MediaMTX Error', `Failed to start MediaMTX: ${err.message}`);
        });

        mediamtxProcess.on('exit', (code, signal) => {
            logToFile(`MediaMTX exited with code ${code} and signal ${signal}`);
        });
    } else {
        logToFile(`[ERROR] MediaMTX not found at ${MEDIAMTX_PATH}`);
        dialog.showErrorBox('Missing Dependency', `MediaMTX executable not found at:\n${MEDIAMTX_PATH}`);
    }

    // Start Express Server
    try {
        logToFile('Starting Express server with dynamic port...');
        // Pass 0 to let OS assign a random available port
        const { port } = await startServer(0);
        logToFile(`Express server started on port ${port}, creating window...`);
        createWindow(port);
    } catch (err) {
        logToFile(`Failed to start Express server: ${err.message}`);
        dialog.showErrorBox('Server Error', `Failed to start application server:\n${err.message}`);
        app.quit();
    }
}

app.on('ready', startApp);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
    if (mediamtxProcess) {
        logToFile('Killing MediaMTX process...');
        mediamtxProcess.kill();
    }
});

app.on('activate', function () {
    if (mainWindow === null) startApp();
});
