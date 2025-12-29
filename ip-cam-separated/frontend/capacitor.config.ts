import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.ipcamclient.app',
    appName: 'IP Cam Client',
    webDir: 'dist',
    server: {
        // 使用 https scheme 以支持 WebRTC 等安全上下文 API
        androidScheme: 'https'
    },
    plugins: {
        LocalNotifications: {
            smallIcon: 'ic_stat_icon',
            iconColor: '#488AFF'
        }
    }
};

export default config;
