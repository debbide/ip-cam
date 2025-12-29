import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// 简化的服务器配置接口（用户只需填写这些）
export interface ServerConfig {
  host: string;
  apiPort: number;
  password?: string; // 可选密码
}

// 完整的服务器信息（从后端获取）
export interface ServerInfo {
  name: string;
  version: string;
  authRequired: boolean;
  streams: number;
  ports: {
    api: number;
    rtsp: number;
    hls: number;
    webrtc: number;
  };
}

// 默认配置
const DEFAULT_CONFIG: ServerConfig = {
  host: 'localhost',
  apiPort: 3001,
  password: '',
};

const STORAGE_KEY = 'ip_cam_server_config';
const TOKEN_KEY = 'ip_cam_auth_token';

// 服务器上下文接口
interface ServerContextType {
  config: ServerConfig;
  setConfig: (config: ServerConfig) => void;
  serverInfo: ServerInfo | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  authRequired: boolean;
  token: string | null;
  connect: (password?: string) => Promise<boolean>;
  disconnect: () => void;
  getApiUrl: (path?: string) => string;
  getHlsUrl: (streamId: string) => string;
  getWebrtcUrl: (streamId: string) => string;
  getRtspUrl: (streamId: string) => string;
  getAuthHeaders: () => HeadersInit;
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

  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });

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
    setServerInfo(null);
    setConnectionError(null);
  }, []);

  // 保存 Token
  const saveToken = useCallback((newToken: string | null) => {
    setToken(newToken);
    try {
      if (newToken) {
        localStorage.setItem(TOKEN_KEY, newToken);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.error('Failed to save token:', e);
    }
  }, []);

  // 获取 API URL
  const getApiUrl = useCallback((path: string = '') => {
    const base = `http://${config.host}:${config.apiPort}`;
    return path ? `${base}${path.startsWith('/') ? path : '/' + path}` : base;
  }, [config.host, config.apiPort]);

  // 获取认证头
  const getAuthHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  // 获取 HLS URL（使用从服务器获取的端口）
  const getHlsUrl = useCallback((streamId: string) => {
    const port = serverInfo?.ports.hls || 8888;
    return `http://${config.host}:${port}/${streamId}/index.m3u8`;
  }, [config.host, serverInfo]);

  // 获取 WebRTC URL (WHEP 接口)
  const getWebrtcUrl = useCallback((streamId: string) => {
    const port = serverInfo?.ports.webrtc || 8889;
    return `http://${config.host}:${port}/${streamId}/whep`;
  }, [config.host, serverInfo]);

  // 获取 RTSP URL
  const getRtspUrl = useCallback((streamId: string) => {
    const port = serverInfo?.ports.rtsp || 8554;
    return `rtsp://${config.host}:${port}/${streamId}`;
  }, [config.host, serverInfo]);

  // 连接服务器
  const connect = useCallback(async (password?: string): Promise<boolean> => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // 1. 获取服务器信息
      const infoResponse = await fetch(getApiUrl('/api/server-info'), {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!infoResponse.ok) {
        throw new Error(`HTTP ${infoResponse.status}`);
      }

      const info: ServerInfo = await infoResponse.json();
      console.log('Server info:', info);
      setServerInfo(info);

      // 2. 如果需要认证，进行登录
      if (info.authRequired) {
        if (!password && !token) {
          setConnectionError('需要密码');
          setIsConnecting(false);
          return false;
        }

        // 如果有新密码，进行登录
        if (password) {
          const loginResponse = await fetch(getApiUrl('/api/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
            signal: AbortSignal.timeout(5000),
          });

          if (!loginResponse.ok) {
            const error = await loginResponse.json();
            throw new Error(error.error || '认证失败');
          }

          const loginData = await loginResponse.json();
          if (loginData.token) {
            saveToken(loginData.token);
          }
        }
        // 如果没有新密码但有旧 token，验证 token 是否有效
        else if (token) {
          const testResponse = await fetch(getApiUrl('/api/streams'), {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            signal: AbortSignal.timeout(5000),
          });

          if (!testResponse.ok) {
            saveToken(null);
            setConnectionError('Token 已过期，请重新输入密码');
            setIsConnecting(false);
            return false;
          }
        }
      }

      setIsConnected(true);
      setConnectionError(null);
      return true;
    } catch (e: any) {
      console.error('Connection failed:', e);
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
  }, [getApiUrl, token, saveToken]);

  // 断开连接
  const disconnect = useCallback(() => {
    setIsConnected(false);
    setServerInfo(null);
    saveToken(null);
  }, [saveToken]);

  // 是否需要认证
  const authRequired = serverInfo?.authRequired ?? false;

  // 组件挂载时自动连接
  useEffect(() => {
    connect();
  }, []);

  // 配置变更时重新连接
  useEffect(() => {
    const timer = setTimeout(() => {
      connect();
    }, 500);
    return () => clearTimeout(timer);
  }, [config.host, config.apiPort]);

  return (
    <ServerContext.Provider
      value={{
        config,
        setConfig,
        serverInfo,
        isConnected,
        isConnecting,
        connectionError,
        authRequired,
        token,
        connect,
        disconnect,
        getApiUrl,
        getHlsUrl,
        getWebrtcUrl,
        getRtspUrl,
        getAuthHeaders,
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
