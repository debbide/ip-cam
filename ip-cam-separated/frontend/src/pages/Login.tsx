import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useServer } from '@/contexts/ServerContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Camera, Eye, EyeOff, Loader2, Settings, Server, CheckCircle2, XCircle, Loader } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const { config, setConfig, isConnected, isConnecting, connectionError, connect } = useServer();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // 服务器配置对话框
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverHost, setServerHost] = useState(config.host);
  const [serverPort, setServerPort] = useState(config.apiPort.toString());

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // 同步配置到本地状态
  useEffect(() => {
    setServerHost(config.host);
    setServerPort(config.apiPort.toString());
  }, [config]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      toast.error('请先配置并连接服务器');
      setShowServerConfig(true);
      return;
    }

    if (!username || !password) {
      toast.error('请填写用户名和密码');
      return;
    }

    setIsLoading(true);

    try {
      const success = await login(username, password, rememberMe);

      if (success) {
        toast.success('登录成功');
        navigate('/');
      } else {
        toast.error('用户名或密码错误');
      }
    } catch (err) {
      toast.error('登录失败，请检查服务器连接');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveServerConfig = async () => {
    const port = parseInt(serverPort, 10);
    if (!serverHost.trim()) {
      toast.error('请输入服务器地址');
      return;
    }
    if (isNaN(port) || port < 1 || port > 65535) {
      toast.error('请输入有效的端口号 (1-65535)');
      return;
    }

    setConfig({
      host: serverHost.trim(),
      apiPort: port,
    });

    // 等待配置生效后尝试连接
    setTimeout(async () => {
      const success = await connect();
      if (success) {
        toast.success('服务器连接成功');
        setShowServerConfig(false);
      } else {
        toast.error('连接失败，请检查服务器地址和端口');
      }
    }, 100);
  };

  const handleTestConnection = async () => {
    const port = parseInt(serverPort, 10);
    if (!serverHost.trim() || isNaN(port)) {
      toast.error('请输入有效的服务器地址和端口');
      return;
    }

    // 临时保存配置并测试
    setConfig({
      host: serverHost.trim(),
      apiPort: port,
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Camera className="h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold">NVR 监控系统</h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>登录</CardTitle>
            <CardDescription>
              请输入您的登录凭证
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* 服务器连接状态 */}
            <div
              className="mb-4 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setShowServerConfig(true)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">服务器</span>
                </div>
                <div className="flex items-center gap-2">
                  {isConnecting ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin text-yellow-500" />
                      <span className="text-sm text-yellow-500">连接中...</span>
                    </>
                  ) : isConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">已连接</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-500">
                        {connectionError || '未连接'}
                      </span>
                    </>
                  )}
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {config.host}:{config.apiPort}
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">用户名</Label>
                <Input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  autoComplete="username"
                  disabled={isLoading || !isConnected}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">密码</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    disabled={isLoading || !isConnected}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={isLoading || !isConnected}
                />
                <Label
                  htmlFor="remember-me"
                  className="text-sm font-normal cursor-pointer"
                >
                  记住登录（30天）
                </Label>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isConnected}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : !isConnected ? (
                  '请先连接服务器'
                ) : (
                  '登录'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground">
                如需创建新账户，请联系管理员
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 服务器配置对话框 */}
      <Dialog open={showServerConfig} onOpenChange={setShowServerConfig}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              服务器配置
            </DialogTitle>
            <DialogDescription>
              请输入后端服务器的地址和端口
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="server-host">服务器地址</Label>
              <Input
                id="server-host"
                type="text"
                value={serverHost}
                onChange={(e) => setServerHost(e.target.value)}
                placeholder="例如: 192.168.1.100 或 example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-port">API 端口</Label>
              <Input
                id="server-port"
                type="number"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
                placeholder="默认: 3001"
                min={1}
                max={65535}
              />
            </div>

            {/* 连接状态 */}
            <div className="p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                {isConnecting ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin text-yellow-500" />
                    <span className="text-sm">正在连接...</span>
                  </>
                ) : isConnected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-500">连接成功</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-500">
                      {connectionError || '未连接'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isConnecting}
            >
              测试连接
            </Button>
            <Button
              type="button"
              onClick={handleSaveServerConfig}
              disabled={isConnecting}
            >
              保存并连接
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
