import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, hasUsers } = useAuth();

  // 如果没有用户，跳转到登录页创建管理员
  if (!hasUsers) {
    return <Navigate to="/login" replace />;
  }

  // 如果未登录，跳转到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
