import { useState } from 'react';
import { Server, Wifi, WifiOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
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
    isConnected,
    isConnecting,
    connectionError,
    testConnection,
  } = useServer();

  const [open, setOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<ServerConfig>(config);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // 打开对话框时同步配置
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTempConfig(config);
      setTestResult(null);
    }
    setOpen(isOpen);
  };

  // 测试连接
  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(
        `http://${tempConfig.host}:${tempConfig.apiPort}/api/server-info`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        }
      );

      if (response.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
      }
    } catch (e) {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  // 保存配置
  const handleSave = () => {
    setConfig(tempConfig);
    setOpen(false);
  };

  // 重置为默认值
  const handleReset = () => {
    setTempConfig(DEFAULT_CONFIG);
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

          {/* 端口配置 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apiPort">API 端口</Label>
              <Input
                id="apiPort"
                type="number"
                value={tempConfig.apiPort}
                onChange={(e) =>
                  setTempConfig({
                    ...tempConfig,
                    apiPort: parseInt(e.target.value) || 3001,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webrtcPort">WebRTC 端口</Label>
              <Input
                id="webrtcPort"
                type="number"
                value={tempConfig.webrtcPort}
                onChange={(e) =>
                  setTempConfig({
                    ...tempConfig,
                    webrtcPort: parseInt(e.target.value) || 8889,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hlsPort">HLS 端口</Label>
              <Input
                id="hlsPort"
                type="number"
                value={tempConfig.hlsPort}
                onChange={(e) =>
                  setTempConfig({
                    ...tempConfig,
                    hlsPort: parseInt(e.target.value) || 8888,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtspPort">RTSP 端口</Label>
              <Input
                id="rtspPort"
                type="number"
                value={tempConfig.rtspPort}
                onChange={(e) =>
                  setTempConfig({
                    ...tempConfig,
                    rtspPort: parseInt(e.target.value) || 8554,
                  })
                }
              />
            </div>
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

            {testResult === 'error' && (
              <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">连接失败</span>
              </div>
            )}
          </div>

          {/* 当前连接状态 */}
          <div className="rounded-lg bg-muted p-3 text-sm">
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
            {isConnected && (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">服务器:</span>
                <span className="font-mono text-xs">
                  {config.host}:{config.apiPort}
                </span>
              </div>
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
