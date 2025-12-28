import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// 判断是否为开发环境
const isDev = !app.isPackaged;

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

// 确保保存目录存在
function ensureSaveDirectory() {
    const config = loadConfig();
    if (!fs.existsSync(config.savePath)) {
        fs.mkdirSync(config.savePath, { recursive: true });
    }
    return config.savePath;
}

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
                    .sort((a, b) => a.mtime - b.mtime);

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

// ===== IPC Handlers =====

ipcMain.handle('get-storage-stats', async () => {
    const config = loadConfig();
    const savePath = config.savePath;
    const totalSize = calculateFolderSize(savePath);

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

async function sendNotification(message, imageBase64 = null) {
    const config = loadConfig();
    const nc = config.notification;

    if (!nc || !nc.enabled) {
        return { success: false, error: '通知未启用' };
    }

    try {
        if (nc.type === 'telegram') {
            const botToken = nc.telegramBotToken;
            const chatId = nc.telegramChatId;

            if (!botToken || !chatId) {
                return { success: false, error: 'Telegram 配置不完整' };
            }

            if (imageBase64) {
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

                if (!response.ok) {
                    const responseText = await response.text();
                    return { success: false, error: `HTTP ${response.status}: ${responseText.substring(0, 200)}` };
                }
            } else {
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
            const webhookUrl = nc.wecomWebhookUrl;
            if (!webhookUrl) {
                return { success: false, error: '企业微信 Webhook URL 未配置' };
            }

            if (imageBase64) {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ msgtype: 'text', text: { content: message } })
                });

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
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ msgtype: 'text', text: { content: message } })
                });
                const result = await response.json();
                if (result.errcode !== 0) {
                    return { success: false, error: result.errmsg };
                }
            }
            return { success: true };

        } else if (nc.type === 'dingtalk') {
            const webhookUrl = nc.webhookUrl;
            if (!webhookUrl) {
                return { success: false, error: '钉钉 Webhook URL 未配置' };
            }

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msgtype: 'text', text: { content: message } })
            });
            const result = await response.json();
            if (result.errcode !== 0) {
                return { success: false, error: result.errmsg };
            }
            return { success: true };

        } else {
            const webhookUrl = nc.webhookUrl;
            if (!webhookUrl) {
                return { success: false, error: 'Webhook URL 未配置' };
            }

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    timestamp: new Date().toISOString(),
                    image: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null
                })
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
    return await sendNotification('🔔 测试通知：IP Cam Client 报警系统已连接！');
});

ipcMain.handle('send-notification', async (event, message, imageBase64) => {
    return await sendNotification(message, imageBase64);
});

// ===== 文件管理 =====

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

        let targetPath = basePath;
        if (subfolder) {
            targetPath = path.join(basePath, subfolder);
            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }
        }

        const filePath = path.join(targetPath, filename);
        const base64Data = dataUrl.replace(/^data:[a-z]+\/[a-z0-9+.-]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        fs.writeFileSync(filePath, buffer);
        console.log(`File saved: ${filePath}`);

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

// ===== 窗口管理 =====

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
        },
        autoHideMenuBar: true,
    });

    // 开发模式加载 Vite 开发服务器，生产模式加载本地文件
    if (isDev) {
        mainWindow.loadURL('http://localhost:8080');
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// ===== 应用生命周期 =====

app.on('ready', () => {
    console.log('=================================');
    console.log('IP Cam Client (前后端分离版)');
    console.log('=================================');
    console.log('配置文件路径:', CONFIG_PATH);
    console.log('=================================');
    createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});
