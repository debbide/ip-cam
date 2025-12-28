// Global type declarations for Electron API exposed via preload.js

interface SavedFile {
    name: string;
    path: string;
    size: number;
    created: Date;
    modified: Date;
    folder: string;
}

interface SavedFilesResult {
    截图: SavedFile[];
    录像: SavedFile[];
    人形检测: SavedFile[];
    移动侦测: SavedFile[];
}

interface ElectronAPI {
    selectDirectory: () => Promise<string | null>;
    saveFile: (dataUrl: string, filename: string, subfolder?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    getSavePath: () => Promise<string>;
    setSavePath: (path: string) => Promise<boolean>;
    openSaveFolder: () => Promise<boolean>;
    listSavedFiles: () => Promise<{ success: boolean; files?: SavedFilesResult; error?: string }>;
    deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    getFileUrl: (filePath: string) => Promise<{ success: boolean; url?: string; error?: string }>;
    getStorageStats: () => Promise<{ usedBytes: number; path: string; quotaGB: number; enabled: boolean }>;
    updateStorageSettings: (settings: { enabled: boolean; maxSizeGB: number }) => Promise<boolean>;
    getNotificationConfig: () => Promise<NotificationConfig>;
    updateNotificationConfig: (config: NotificationConfig) => Promise<boolean>;
    sendTestNotification: () => Promise<{ success: boolean; error?: string }>;
    sendNotification: (message: string, imageBase64?: string) => Promise<{ success: boolean; error?: string }>;
}

interface StorageSettings {
    enabled: boolean;
    maxSizeGB: number;
}

interface NotificationConfig {
    enabled: boolean;
    type: 'telegram' | 'dingtalk' | 'webhook';
    webhookUrl: string;
    telegramBotToken: string;
    telegramChatId: string;
}

interface Window {
    electronAPI?: ElectronAPI;
}
