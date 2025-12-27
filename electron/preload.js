const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 选择保存目录
    selectDirectory: () => ipcRenderer.invoke('select-directory'),

    // 保存文件（支持子文件夹：截图/录像/人形检测）
    saveFile: (data, filename, subfolder = '') => ipcRenderer.invoke('save-file', data, filename, subfolder),

    // 获取设置的保存路径
    getSavePath: () => ipcRenderer.invoke('get-save-path'),

    // 设置保存路径
    setSavePath: (path) => ipcRenderer.invoke('set-save-path', path),

    // 打开保存目录
    openSaveFolder: () => ipcRenderer.invoke('open-save-folder'),

    // 获取保存的文件列表
    listSavedFiles: () => ipcRenderer.invoke('list-saved-files'),

    // 删除文件
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),

    // 获取文件 URL
    // 获取文件 URL
    getFileUrl: (filePath) => ipcRenderer.invoke('get-file-url', filePath),

    // 获取存储状态
    getStorageStats: () => ipcRenderer.invoke('get-storage-stats'),

    // 更新存储设置
    // 更新存储设置
    updateStorageSettings: (settings) => ipcRenderer.invoke('update-storage-settings', settings),

    // 获取通知配置
    getNotificationConfig: () => ipcRenderer.invoke('get-notification-config'),

    // 更新通知配置
    updateNotificationConfig: (config) => ipcRenderer.invoke('update-notification-config', config),

    // 发送测试通知
    sendTestNotification: () => ipcRenderer.invoke('send-test-notification'),

    // 发送通知（带截图）
    sendNotification: (message, imageBase64) => ipcRenderer.invoke('send-notification', message, imageBase64),

    // 获取应用日志
    getAppLogs: () => ipcRenderer.invoke('get-app-logs'),

    // ===== Persistent Store (replaces localStorage for portable mode) =====
    storeGet: (key) => ipcRenderer.invoke('store-get', key),
    storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
    storeRemove: (key) => ipcRenderer.invoke('store-remove', key),
});
