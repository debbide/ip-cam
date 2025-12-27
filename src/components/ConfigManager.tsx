import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Settings, FolderOpen, FolderCheck, HardDrive, Sliders, Bell } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { getSavePath, selectSaveDirectory, openSaveFolder } from '@/utils/fileSaver';
import { StorageSettings } from '@/components/StorageSettings';
import { NotificationSettings } from '@/components/NotificationSettings';

export function ConfigManager() {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // 检查是否在 Electron 环境中
    setIsElectron(!!window.electronAPI);

    // 加载当前保存路径
    const loadPath = async () => {
      const path = await getSavePath();
      if (path) {
        setCurrentPath(path);
      }
    };
    if (open) {
      loadPath();
    }
  }, [open]);

  const handleSelectDirectory = async () => {
    const path = await selectSaveDirectory();
    if (path) {
      setCurrentPath(path);
      toast.success('保存路径已更新', { description: path });
    }
  };

  const handleOpenFolder = async () => {
    await openSaveFolder();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9" title="设置">
          <Settings className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            应用设置
          </DialogTitle>
          <DialogDescription>
            配置应用的全局设置和存储策略
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="gap-2">
              <Sliders className="w-4 h-4" />
              常规
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-2" disabled={!isElectron}>
              <HardDrive className="w-4 h-4" />
              存储
            </TabsTrigger>
            <TabsTrigger value="notification" className="gap-2" disabled={!isElectron}>
              <Bell className="w-4 h-4" />
              通知
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-4">
            {/* 保存路径设置 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">截图 / 录像保存路径</h4>
              {isElectron ? (
                <>
                  <div className="p-2 bg-secondary rounded text-sm font-mono break-all">
                    {currentPath || '未设置'}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={handleSelectDirectory}>
                      <FolderOpen className="w-4 h-4" />
                      选择路径
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleOpenFolder}>
                      <FolderCheck className="w-4 h-4" />
                      打开文件夹
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  在 Electron 客户端中可配置保存路径。浏览器环境下将使用默认下载目录。
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="storage" className="mt-4">
            <StorageSettings />
          </TabsContent>

          <TabsContent value="notification" className="mt-4">
            <NotificationSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
