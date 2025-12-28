import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// 服务器配置接口
export interface ServerConfig {
  host: string;
  apiPort: number;
  rtspPort: number;
  hlsPort: number;
  webrtcPort: number;
}

// 默认配置
const DEFAULT_CONFIG: ServerConfig = {
  host: 'localhost',
  apiPort: 3001,
  rtspPort: 8554,
  hlsPort: 8888,
  webrtcPort: 8889,
};

const STORAGE_KEY = 'ip_cam_server_config';

// 服务器上下文接口
interface ServerContextType {
  config: ServerConfig;
  setConfig: (config: ServerConfig) => void;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  testConnection: () => Promise<boolean>;
  getApiUrl: (path?: string) => string;
  getHlsUrl: (streamId: string) => string;
  getWebrtcUrl: (streamId: string) => string;
  getRtspUrl: (streamId: string) => string;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<ServerConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load server config:', e);
    }
    return DEFAULT_CONFIG;
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // 保存配置
  const setConfig = useCallback((newConfig: ServerConfig) => {
    setConfigState(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.error('Failed to save server config:', e);
    }
    // 配置变更后重置连接状态
    setIsConnected(false);
    setConnectionError(null);
  }, []);

  // 获取 API URL
  const getApiUrl = useCallback((path: string = '') => {
    const base = `http://${config.host}:${config.apiPort}`;
    return path ? `${base}${path.startsWith('/') ? path : '/' + path}` : base;
  }, [config.host, config.apiPort]);

  // 获取 HLS URL
  const getHlsUrl = useCallback((streamId: string) => {
    return `http://${config.host}:${config.hlsPort}/${streamId}/index.m3u8`;
  }, [config.host, config.hlsPort]);

  // 获取 WebRTC URL
  const getWebrtcUrl = useCallback((streamId: string) => {
    return `http://${config.host}:${config.webrtcPort}/${streamId}`;
  }, [config.host, config.webrtcPort]);

  // 获取 RTSP URL
  const getRtspUrl = useCallback((streamId: string) => {
    return `rtsp://${config.host}:${config.rtspPort}/${streamId}`;
  }, [config.host, config.rtspPort]);

  // 测试连接
  const testConnection = useCallback(async (): Promise<boolean> => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const response = await fetch(getApiUrl('/api/server-info'), {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5秒超时
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Server info:', data);
        setIsConnected(true);
        setConnectionError(null);
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e: any) {
      console.error('Connection test failed:', e);
      setIsConnected(false);
      if (e.name === 'TimeoutError') {
        setConnectionError('连接超时');
      } else if (e.message.includes('Failed to fetch')) {
        setConnectionError('无法连接到服务器');
      } else {
        setConnectionError(e.message || '连接失败');
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [getApiUrl]);

  // 组件挂载时自动测试连接
  useEffect(() => {
    testConnection();
  }, []);

  // 配置变更时重新测试连接
  useEffect(() => {
    const timer = setTimeout(() => {
      testConnection();
    }, 500);
    return () => clearTimeout(timer);
  }, [config.host, config.apiPort]);

  return (
    <ServerContext.Provider
      value={{
        config,
        setConfig,
        isConnected,
        isConnecting,
        connectionError,
        testConnection,
        getApiUrl,
        getHlsUrl,
        getWebrtcUrl,
        getRtspUrl,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const context = useContext(ServerContext);
  if (context === undefined) {
    throw new Error('useServer must be used within a ServerProvider');
  }
  return context;
}

// 导出默认配置供其他组件使用
export { DEFAULT_CONFIG };
