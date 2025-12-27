import { Camera } from '@/types/camera';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Smartphone,
  Plus,
  RefreshCw,
  Circle,
  Wifi,
  WifiOff,
  Settings,
  Trash2,
  X
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

interface DeviceSidebarProps {
  cameras: Camera[];
  selectedCamera?: Camera;
  onSelectCamera: (camera: Camera) => void;
  onAddDevice: () => void;
  onEditDevice: (camera: Camera) => void;
  onDeleteDevice?: (cameraId: string) => void;
  isMobile?: boolean;
  onClose?: () => void;
}

export function DeviceSidebar({
  cameras,
  selectedCamera,
  onSelectCamera,
  onAddDevice,
  onEditDevice,
  onDeleteDevice,
  isMobile = false,
  onClose,
}: DeviceSidebarProps) {
  const [deleteConfirmCamera, setDeleteConfirmCamera] = useState<Camera | null>(null);
  const onlineCount = cameras.filter(c => c.status === 'online').length;

  const handleEdit = (e: React.MouseEvent, camera: Camera) => {
    e.stopPropagation();
    onEditDevice(camera);
  };

  const handleDelete = (e: React.MouseEvent, camera: Camera) => {
    e.stopPropagation();
    setDeleteConfirmCamera(camera);
  };

  const confirmDelete = () => {
    if (deleteConfirmCamera && onDeleteDevice) {
      onDeleteDevice(deleteConfirmCamera.id);
      setDeleteConfirmCamera(null);
    }
  };

  const handleSelectCamera = (camera: Camera) => {
    onSelectCamera(camera);
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <div className={`h-full bg-sidebar border-r border-sidebar-border flex flex-col ${isMobile ? 'w-full' : 'w-72'}`}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-sidebar-foreground flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            设备列表
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isMobile && onClose && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-success glow-success" />
            {onlineCount} 在线
          </span>
          <span className="text-border">|</span>
          <span>{cameras.length} 总数</span>
        </div>
      </div>

      {/* Device List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {cameras.map((camera) => (
            <button
              key={camera.id}
              onClick={() => handleSelectCamera(camera)}
              className={`group/item w-full p-3 rounded-lg text-left transition-all duration-200 ${selectedCamera?.id === camera.id
                ? 'bg-primary/10 border border-primary/30'
                : 'hover:bg-sidebar-accent border border-transparent'
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusIndicator status={camera.status} />
                    <span className="font-medium text-sm text-sidebar-foreground truncate">
                      {camera.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {camera.deviceName}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground/70 mt-0.5">
                    {camera.ipAddress}:{camera.port}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => handleEdit(e, camera)}
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                    {onDeleteDevice && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => handleDelete(e, camera)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {camera.isRecording && (
                      <Circle className="w-2.5 h-2.5 fill-destructive text-destructive animate-recording" />
                    )}
                    {camera.status === 'online' && (
                      <Wifi className="w-3.5 h-3.5 text-success" />
                    )}
                    {camera.status === 'offline' && (
                      <WifiOff className="w-3.5 h-3.5 text-destructive" />
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}

          {cameras.length === 0 && (
            <div className="p-6 text-center">
              <Smartphone className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">暂无设备</p>
              <p className="text-xs text-muted-foreground/70 mt-1">点击下方按钮添加</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add Device Button */}
      <div className="p-3 border-t border-sidebar-border">
        <Button className="w-full gap-2" onClick={onAddDevice}>
          <Plus className="w-4 h-4" />
          添加设备
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmCamera} onOpenChange={() => setDeleteConfirmCamera(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除设备</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 "{deleteConfirmCamera?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusIndicator({ status }: { status: Camera['status'] }) {
  const config = {
    online: { color: 'bg-success', glow: 'glow-success' },
    offline: { color: 'bg-destructive', glow: '' },
    connecting: { color: 'bg-warning', glow: 'animate-pulse' },
  };

  return (
    <div className={`w-2 h-2 rounded-full ${config[status].color} ${config[status].glow}`} />
  );
}
