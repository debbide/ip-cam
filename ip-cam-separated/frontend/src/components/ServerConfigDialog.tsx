import { useState, useEffect } from 'react';
import { Server, Wifi, WifiOff, RefreshCw, Check, AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useServer, ServerConfig, DEFAULT_CONFIG } from '@/contexts/ServerContext';
import { cn } from '@/lib/utils';

interface ServerConfigDialogProps {
  trigger?: React.ReactNode;
}

export function ServerConfigDialog({ trigger }: ServerConfigDialogProps) {
  const {
    config,
    setConfig,
    serverInfo,
    isConnected,
    isConnecting,
    connectionError,
    authRequired,
    connect,
  } = useServer();

  const [open, setOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<ServerConfig>(config);
  const [password, setPassword] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | 'needPassword' | null>(null);

  // 打开对话框时同步配置
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTempConfig(config);
      setPassword('');
      setTestResult(null);
    }
    setOpen(isOpen);
  };

  // 测试连接
  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    // 先保存配置
    setConfig(tempConfig);

    // 等待配置生效
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const success = await connect(password || undefined);
      if (success) {
        setTestResult('success');
      } else {
        // 检查是否需要密码
        if (authRequired && !password) {
          setTestResult('needPassword');
        } else {
          setTestResult('error');
        }
      }
    } catch (e) {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  // 保存配置并关闭
  const handleSave = async () => {
    // 如果配置有变化，才需要保存和重连
    const configChanged = tempConfig.host !== config.host || tempConfig.apiPort !== config.apiPort;

    if (configChanged) {
      setConfig(tempConfig);
      // 等待配置生效后重新连接
      await new Promise(resolve => setTimeout(resolve, 100));
      await connect(password || undefined);
    } else if (password) {
      // 配置没变但有新密码，只执行登录
      await connect(password);
    }
    // 如果配置没变且没有新密码，保持当前连接状态
    setOpen(false);
  };

  // 重置为默认值
  const handleReset = () => {
    setTempConfig(DEFAULT_CONFIG);
    setPassword('');
    setTestResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'gap-2',
              isConnected
                ? 'border-green-500/50 text-green-600 dark:text-green-400'
                : 'border-red-500/50 text-red-600 dark:text-red-400'
            )}
          >
            {isConnecting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isConnected ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isConnecting ? '连接中...' : isConnected ? '已连接' : '未连接'}
            </span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            服务器配置
          </DialogTitle>
          <DialogDescription>
            配置远程后端服务器的连接参数
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 服务器地址 */}
          <div className="space-y-2">
            <Label htmlFor="host">服务器地址</Label>
            <Input
              id="host"
              placeholder="例如: 192.168.1.100"
              value={tempConfig.host}
              onChange={(e) =>
                setTempConfig({ ...tempConfig, host: e.target.value })
              }
            />
          </div>

          {/* API 端口 */}
          <div className="space-y-2">
            <Label htmlFor="apiPort">API 端口</Label>
            <Input
              id="apiPort"
              type="number"
              placeholder="3002"
              value={tempConfig.apiPort}
              onChange={(e) =>
                setTempConfig({
                  ...tempConfig,
                  apiPort: parseInt(e.target.value) || 3002,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              其他端口（WebRTC、HLS、RTSP）将在连接后自动获取
            </p>
          </div>

          {/* 密码（可选） */}
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="h-3 w-3" />
              密码（可选）
            </Label>
            <Input
              id="password"
              type="password"
              placeholder={authRequired ? '需要密码' : '如果服务器需要认证'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* 测试连接按钮和结果 */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || !tempConfig.host}
              className="gap-2"
            >
              {isTesting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              测试连接
            </Button>

            {testResult === 'success' && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span className="text-sm">连接成功</span>
              </div>
            )}

            {testResult === 'needPassword' && (
              <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <Lock className="h-4 w-4" />
                <span className="text-sm">需要密码</span>
              </div>
            )}

            {testResult === 'error' && (
              <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{connectionError || '连接失败'}</span>
              </div>
            )}
          </div>

          {/* 当前连接状态和服务器信息 */}
          <div className="rounded-lg bg-muted p-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">当前状态:</span>
              <span
                className={cn(
                  'font-medium',
                  isConnected ? 'text-green-600' : 'text-red-600'
                )}
              >
                {isConnecting
                  ? '连接中...'
                  : isConnected
                    ? '已连接'
                    : connectionError || '未连接'}
              </span>
            </div>
            {isConnected && serverInfo && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">服务器:</span>
                  <span className="font-mono text-xs">
                    {config.host}:{config.apiPort}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">认证:</span>
                  <span className="text-xs">
                    {serverInfo.authRequired ? '需要密码' : '无需密码'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">端口:</span>
                  <span className="font-mono text-xs">
                    WebRTC:{serverInfo.ports.webrtc} HLS:{serverInfo.ports.hls}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleReset}>
            重置
          </Button>
          <Button onClick={handleSave}>保存配置</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
