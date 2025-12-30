/**
 * 平台抽象层 - 统一 Electron 和 Capacitor 的 API 调用
 * 
 * 自动检测运行环境并调用对应的原生 API
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { nativeFetch } from './nativeHttp';

// ===== 环境检测 =====

export const isElectron = (): boolean => {
    return typeof window !== 'undefined' && !!(window as any).electronAPI;
};

export const isCapacitor = (): boolean => {
    return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
};

export const isWeb = (): boolean => {
    return !isElectron() && !isCapacitor();
};

export const getPlatformName = (): 'electron' | 'capacitor' | 'web' => {
    if (isElectron()) return 'electron';
    if (isCapacitor()) return 'capacitor';
    return 'web';
};

// ===== 配置存储 =====

interface StorageConfig {
    savePath?: string;
    storage?: {
        enabled: boolean;
        maxSizeGB: number;
    };
    notification?: NotificationConfig;
}

interface NotificationConfig {
    enabled: boolean;
    type: 'webhook' | 'telegram' | 'wecom' | 'dingtalk';
    webhookUrl?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
    wecomWebhookUrl?: string;
}

// Capacitor 配置存储
const STORAGE_KEY = 'ip-cam-config';

async function loadCapacitorConfig(): Promise<StorageConfig> {
    try {
        const { value } = await Preferences.get({ key: STORAGE_KEY });
        return value ? JSON.parse(value) : {};
    } catch {
        return {};
    }
}

async function saveCapacitorConfig(config: StorageConfig): Promise<void> {
    await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(config)
    });
}

// ===== 文件系统 API =====

export interface SaveFileResult {
    success: boolean;
    path?: string;
    error?: string;
}

export interface FileInfo {
    name: string;
    path: string;
    size: number;
    created: Date;
    modified: Date;
    folder: string;
}

export interface ListFilesResult {
    success: boolean;
    files?: {
        截图: FileInfo[];
        录像: FileInfo[];
        人形检测: FileInfo[];
        移动侦测: FileInfo[];
    };
    error?: string;
}

/**
 * 保存文件到本地存储
 */
export async function saveFile(
    dataUrl: string,
    filename: string,
    subfolder: string = ''
): Promise<SaveFileResult> {
    if (isElectron()) {
        return await (window as any).electronAPI.saveFile(dataUrl, filename, subfolder);
    }

    if (isCapacitor()) {
        try {
            // 从 dataUrl 提取 base64 数据
            const base64Data = dataUrl.replace(/^data:[a-z]+\/[a-z0-9+.-]+;base64,/, '');

            // 构建路径
            const directory = Directory.Documents;
            const path = subfolder ? `IP-Cam/${subfolder}/${filename}` : `IP-Cam/${filename}`;

            // 确保目录存在
            const dirPath = subfolder ? `IP-Cam/${subfolder}` : 'IP-Cam';
            try {
                await Filesystem.mkdir({
                    path: dirPath,
                    directory,
                    recursive: true
                });
            } catch {
                // 目录可能已存在
            }

            // 写入文件
            const result = await Filesystem.writeFile({
                path,
                data: base64Data,
                directory
            });

            return { success: true, path: result.uri };
        } catch (error: any) {
            console.error('[Platform] Failed to save file:', error);
            return { success: false, error: error.message };
        }
    }

    // Web 降级：使用浏览器下载
    try {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.click();
        return { success: true, path: filename };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * 获取保存路径
 */
export async function getSavePath(): Promise<string> {
    if (isElectron()) {
        return await (window as any).electronAPI.getSavePath();
    }

    if (isCapacitor()) {
        return 'Documents/IP-Cam';
    }

    return '浏览器下载目录';
}

/**
 * 选择保存目录（仅 Electron 支持）
 */
export async function selectDirectory(): Promise<string | null> {
    if (isElectron()) {
        return await (window as any).electronAPI.selectDirectory();
    }

    // Capacitor 和 Web 不支持选择目录
    return null;
}

/**
 * 打开保存目录 / 分享文件
 */
export async function openSaveFolder(): Promise<boolean> {
    if (isElectron()) {
        return await (window as any).electronAPI.openSaveFolder();
    }

    if (isCapacitor()) {
        // 在移动端使用分享功能
        try {
            await Share.share({
                title: 'IP Cam Client 保存目录',
                text: '文件保存在 Documents/IP-Cam 目录',
                dialogTitle: '保存位置提示'
            });
            return true;
        } catch {
            return false;
        }
    }

    return false;
}

/**
 * 列出已保存的文件
 */
export async function listSavedFiles(): Promise<ListFilesResult> {
    if (isElectron()) {
        return await (window as any).electronAPI.listSavedFiles();
    }

    if (isCapacitor()) {
        try {
            const result: ListFilesResult = {
                success: true,
                files: {
                    截图: [],
                    录像: [],
                    人形检测: [],
                    移动侦测: []
                }
            };

            const folders = ['截图', '录像', '人形检测', '移动侦测'] as const;

            for (const folder of folders) {
                try {
                    const { files } = await Filesystem.readdir({
                        path: `IP-Cam/${folder}`,
                        directory: Directory.Documents
                    });

                    result.files![folder] = await Promise.all(
                        files.map(async (file) => {
                            const stat = await Filesystem.stat({
                                path: `IP-Cam/${folder}/${file.name}`,
                                directory: Directory.Documents
                            });
                            return {
                                name: file.name,
                                path: stat.uri,
                                size: stat.size || 0,
                                created: new Date(stat.ctime || Date.now()),
                                modified: new Date(stat.mtime || Date.now()),
                                folder
                            };
                        })
                    );

                    // 按修改时间排序
                    result.files![folder].sort((a, b) => b.modified.getTime() - a.modified.getTime());
                } catch {
                    // 目录可能不存在
                    result.files![folder] = [];
                }
            }

            return result;
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    return { success: false, error: '当前平台不支持文件列表' };
}

/**
 * 删除文件
 */
export async function deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    if (isElectron()) {
        return await (window as any).electronAPI.deleteFile(filePath);
    }

    if (isCapacitor()) {
        try {
            await Filesystem.deleteFile({ path: filePath });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    return { success: false, error: '当前平台不支持删除文件' };
}

/**
 * 获取文件 URL（用于播放/显示）
 */
export async function getFileUrl(filePath: string): Promise<{ success: boolean; url?: string; error?: string }> {
    if (isElectron()) {
        return await (window as any).electronAPI.getFileUrl(filePath);
    }

    if (isCapacitor()) {
        try {
            const result = await Filesystem.readFile({
                path: filePath
            });

            // 根据文件扩展名确定 MIME 类型
            const ext = filePath.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'webm': 'video/webm',
                'mp4': 'video/mp4'
            };
            const mimeType = mimeTypes[ext || ''] || 'application/octet-stream';

            const url = `data:${mimeType};base64,${result.data}`;
            return { success: true, url };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    return { success: false, error: '当前平台不支持获取文件 URL' };
}

// ===== 存储管理 API =====

export interface StorageStats {
    usedBytes: number;
    path: string;
    quotaGB: number;
    enabled: boolean;
}

export async function getStorageStats(): Promise<StorageStats> {
    if (isElectron()) {
        return await (window as any).electronAPI.getStorageStats();
    }

    if (isCapacitor()) {
        const config = await loadCapacitorConfig();
        let usedBytes = 0;

        try {
            const folders = ['截图', '录像', '人形检测', '移动侦测'];
            for (const folder of folders) {
                try {
                    const { files } = await Filesystem.readdir({
                        path: `IP-Cam/${folder}`,
                        directory: Directory.Documents
                    });
                    for (const file of files) {
                        try {
                            const stat = await Filesystem.stat({
                                path: `IP-Cam/${folder}/${file.name}`,
                                directory: Directory.Documents
                            });
                            usedBytes += stat.size || 0;
                        } catch {
                            // ignore
                        }
                    }
                } catch {
                    // 目录不存在
                }
            }
        } catch {
            // ignore
        }

        return {
            usedBytes,
            path: 'Documents/IP-Cam',
            quotaGB: config.storage?.maxSizeGB || 0,
            enabled: config.storage?.enabled || false
        };
    }

    return {
        usedBytes: 0,
        path: '',
        quotaGB: 0,
        enabled: false
    };
}

export async function updateStorageSettings(settings: { enabled: boolean; maxSizeGB: number }): Promise<boolean> {
    if (isElectron()) {
        return await (window as any).electronAPI.updateStorageSettings(settings);
    }

    if (isCapacitor()) {
        const config = await loadCapacitorConfig();
        config.storage = settings;
        await saveCapacitorConfig(config);
        return true;
    }

    return false;
}

// ===== 通知系统 API =====

export async function getNotificationConfig(): Promise<NotificationConfig | null> {
    if (isElectron()) {
        return await (window as any).electronAPI.getNotificationConfig();
    }

    if (isCapacitor()) {
        const config = await loadCapacitorConfig();
        return config.notification || null;
    }

    return null;
}

export async function updateNotificationConfig(notificationConfig: NotificationConfig): Promise<boolean> {
    if (isElectron()) {
        return await (window as any).electronAPI.updateNotificationConfig(notificationConfig);
    }

    if (isCapacitor()) {
        const config = await loadCapacitorConfig();
        config.notification = notificationConfig;
        await saveCapacitorConfig(config);
        return true;
    }

    return false;
}

export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
    if (isElectron()) {
        return await (window as any).electronAPI.sendTestNotification();
    }

    if (isCapacitor()) {
        return await sendNotification('🔔 测试通知：IP Cam Client 报警系统已连接！');
    }

    return { success: false, error: '当前平台不支持通知' };
}

/**
 * 发送通知（支持带图片）
 * 在 Capacitor 环境下直接通过 HTTP 发送，不依赖主进程
 */
export async function sendNotification(
    message: string,
    imageBase64?: string
): Promise<{ success: boolean; error?: string }> {
    if (isElectron()) {
        return await (window as any).electronAPI.sendNotification(message, imageBase64);
    }

    if (isCapacitor()) {
        const config = await loadCapacitorConfig();
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
                    // 将 base64 转换为 Blob
                    const byteCharacters = atob(imageBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'image/jpeg' });

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
                    const response = await nativeFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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

                const response = await nativeFetch(webhookUrl, {
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
                // 通用 Webhook
                const webhookUrl = nc.webhookUrl;
                if (!webhookUrl) {
                    return { success: false, error: 'Webhook URL 未配置' };
                }

                const response = await nativeFetch(webhookUrl, {
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
        } catch (error: any) {
            console.error('[Platform] Notification error:', error);
            return { success: false, error: error.message };
        }
    }

    return { success: false, error: '当前平台不支持通知' };
}

// ===== 导出统一 API 对象 =====

export const PlatformAPI = {
    // 环境检测
    isElectron,
    isCapacitor,
    isWeb,
    getPlatformName,

    // 文件系统
    saveFile,
    getSavePath,
    selectDirectory,
    openSaveFolder,
    listSavedFiles,
    deleteFile,
    getFileUrl,

    // 存储管理
    getStorageStats,
    updateStorageSettings,

    // 通知系统
    getNotificationConfig,
    updateNotificationConfig,
    sendTestNotification,
    sendNotification
};

export default PlatformAPI;
