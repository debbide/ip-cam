import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.ipcamclient.app',
    appName: 'IP Cam Client',
    webDir: 'dist',
    server: {
        // 使用 https scheme 以支持 WebRTC 等安全上下文 API
        androidScheme: 'https',
        iosScheme: 'https',
        // 允许明文 HTTP 连接（连接局域网服务器）
        cleartext: true
    },
    ios: {
        // 允许任意 HTTP 加载
        allowsLinkPreview: true,
        contentInset: 'automatic'
    },
    plugins: {
        LocalNotifications: {
            smallIcon: 'ic_stat_icon',
            iconColor: '#488AFF'
        }
    }
};

export default config;
