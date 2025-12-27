import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  username: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  login: (username: string, password: string, rememberMe?: boolean) => boolean;
  logout: () => void;
  register: (username: string, password: string, isAdmin?: boolean) => { success: boolean; error?: string };
  hasUsers: boolean;
  getUsers: () => User[];
  addUser: (username: string, password: string, isAdmin: boolean) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (username: string) => { success: boolean; error?: string };
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_KEY = 'nvr_users';
const AUTH_KEY = 'nvr_auth';
const AUTH_EXPIRY_KEY = 'nvr_auth_expiry';
const CURRENT_USER_KEY = 'nvr_current_user';

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

// 简单的密码哈希（生产环境建议使用更强的算法）
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'nvr_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasUsers, setHasUsers] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // 检查是否有用户
    const users = localStorage.getItem(USERS_KEY);
    setHasUsers(!!users && JSON.parse(users).length > 0);
    
    // 检查登录状态和过期时间
    const auth = localStorage.getItem(AUTH_KEY);
    const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    
    if (auth === 'true' && savedUser && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        setIsAuthenticated(true);
        setCurrentUser(JSON.parse(savedUser));
      } else {
        // 已过期，清除登录状态
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(AUTH_EXPIRY_KEY);
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }
  }, []);

  const loginAsync = async (username: string, password: string, rememberMe = false): Promise<boolean> => {
    const usersStr = localStorage.getItem(USERS_KEY);
    if (!usersStr) return false;
    
    const users: User[] = JSON.parse(usersStr);
    const hash = await hashPassword(password);
    const user = users.find(u => u.username === username && u.passwordHash === hash);
    
    if (user) {
      const duration = rememberMe ? REMEMBER_DURATION : SESSION_DURATION;
      const expiryTime = Date.now() + duration;
      
      localStorage.setItem(AUTH_KEY, 'true');
      localStorage.setItem(AUTH_EXPIRY_KEY, expiryTime.toString());
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      setIsAuthenticated(true);
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_EXPIRY_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const register = (username: string, password: string, isAdmin = false): { success: boolean; error?: string } => {
    const validation = validatePassword(password);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('\n') };
    }

    const usersStr = localStorage.getItem(USERS_KEY);
    const users: User[] = usersStr ? JSON.parse(usersStr) : [];
    
    if (users.some(u => u.username === username)) {
      return { success: false, error: '用户名已存在' };
    }

    // 第一个用户自动成为管理员
    const shouldBeAdmin = users.length === 0 ? true : isAdmin;

    // 异步保存
    hashPassword(password).then(hash => {
      const newUser: User = { 
        username, 
        passwordHash: hash, 
        isAdmin: shouldBeAdmin,
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem(AUTH_KEY, 'true');
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
      setHasUsers(true);
      setIsAuthenticated(true);
      setCurrentUser(newUser);
    });

    return { success: true };
  };

  const getUsers = (): User[] => {
    const usersStr = localStorage.getItem(USERS_KEY);
    return usersStr ? JSON.parse(usersStr) : [];
  };

  const addUser = async (username: string, password: string, isAdmin: boolean): Promise<{ success: boolean; error?: string }> => {
    if (username.length < 3) {
      return { success: false, error: '用户名至少3个字符' };
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('\n') };
    }

    const usersStr = localStorage.getItem(USERS_KEY);
    const users: User[] = usersStr ? JSON.parse(usersStr) : [];
    
    if (users.some(u => u.username === username)) {
      return { success: false, error: '用户名已存在' };
    }

    const hash = await hashPassword(password);
    const newUser: User = { 
      username, 
      passwordHash: hash, 
      isAdmin,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    return { success: true };
  };

  const deleteUser = (username: string): { success: boolean; error?: string } => {
    const usersStr = localStorage.getItem(USERS_KEY);
    const users: User[] = usersStr ? JSON.parse(usersStr) : [];
    
    // 不能删除当前用户
    if (currentUser?.username === username) {
      return { success: false, error: '不能删除当前登录用户' };
    }

    // 确保至少保留一个管理员
    const admins = users.filter(u => u.isAdmin);
    const targetUser = users.find(u => u.username === username);
    if (targetUser?.isAdmin && admins.length <= 1) {
      return { success: false, error: '至少需要保留一个管理员' };
    }

    const newUsers = users.filter(u => u.username !== username);
    localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));

    return { success: true };
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: '未登录' };
    }

    // 验证旧密码
    const oldHash = await hashPassword(oldPassword);
    if (oldHash !== currentUser.passwordHash) {
      return { success: false, error: '当前密码错误' };
    }

    // 验证新密码强度
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('\n') };
    }

    // 更新密码
    const usersStr = localStorage.getItem(USERS_KEY);
    const users: User[] = usersStr ? JSON.parse(usersStr) : [];
    const newHash = await hashPassword(newPassword);
    
    const updatedUsers = users.map(u => 
      u.username === currentUser.username 
        ? { ...u, passwordHash: newHash }
        : u
    );
    
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
    
    // 更新当前用户
    const updatedCurrentUser = { ...currentUser, passwordHash: newHash };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedCurrentUser));
    setCurrentUser(updatedCurrentUser);

    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      currentUser,
      login: (u, p, r) => { loginAsync(u, p, r); return true; },
      logout, 
      register,
      hasUsers,
      getUsers,
      addUser,
      deleteUser,
      changePassword
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
