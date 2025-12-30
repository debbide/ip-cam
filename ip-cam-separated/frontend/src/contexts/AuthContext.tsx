import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { nativeFetch } from '@/utils/nativeHttp';
import { useServer } from './ServerContext';

export interface User {
  username: string;
  isAdmin: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  hasUsers: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'nvr_auth_token';
const AUTH_USER_KEY = 'nvr_auth_user';
const AUTH_EXPIRY_KEY = 'nvr_auth_expiry';

// 登录过期时间：普通登录1小时，记住登录30天
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour
const REMEMBER_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

// 强密码验证：至少8位，包含大小写字母、数字和特殊字符
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('密码长度至少8位');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('需要包含大写字母');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('需要包含小写字母');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('需要包含数字');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('需要包含特殊字符 (!@#$%^&*...)');
  }

  return { valid: errors.length === 0, errors };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasUsers, setHasUsers] = useState(true); // 后端总是有用户（默认admin）
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { getApiUrl, isConnected } = useServer();

  useEffect(() => {
    // 检查登录状态和过期时间
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
    const savedUser = localStorage.getItem(AUTH_USER_KEY);

    if (token && savedUser && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        setIsAuthenticated(true);
        setCurrentUser(JSON.parse(savedUser));
      } else {
        // 已过期，清除登录状态
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_EXPIRY_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
      }
    }
  }, []);

  // 登录 - 调用后端 API
  const login = async (username: string, password: string, rememberMe = false): Promise<boolean> => {
    if (!isConnected) {
      console.error('Not connected to server');
      return false;
    }

    try {
      const response = await nativeFetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        console.error('Login failed:', response.status);
        return false;
      }

      const data = await response.json();
      const { token, user } = data;

      if (!token || !user) {
        return false;
      }

      // 保存登录状态
      const duration = rememberMe ? REMEMBER_DURATION : SESSION_DURATION;
      const expiryTime = Date.now() + duration;

      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      localStorage.setItem(AUTH_EXPIRY_KEY, expiryTime.toString());

      setIsAuthenticated(true);
      setCurrentUser(user);
      return true;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EXPIRY_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      currentUser,
      login,
      logout,
      hasUsers,
      isAdmin: currentUser?.isAdmin ?? false,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 权限检查 Hook
export function usePermission() {
  const { currentUser } = useAuth();
  return {
    isAdmin: currentUser?.isAdmin ?? false,
    canManage: currentUser?.isAdmin ?? false,
    canView: true,
  };
}
