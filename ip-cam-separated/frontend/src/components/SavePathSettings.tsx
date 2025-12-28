import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Settings, FolderOpen, FolderCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getSavePath, selectSaveDirectory, openSaveFolder } from '@/utils/fileSaver';

interface SavePathSettingsProps {
    compact?: boolean;
}

export function SavePathSettings({ compact = false }: SavePathSettingsProps) {
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
        loadPath();
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

    if (!isElectron) {
        // 浏览器环境不显示此设置
        return null;
    }

    if (compact) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Settings className="w-5 h-5" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            保存设置
                        </DialogTitle>
                        <DialogDescription>
                            配置截图和录像的保存位置
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">当前保存路径</label>
                            <div className="mt-1 p-2 bg-secondary rounded text-sm font-mono break-all">
                                {currentPath || '未设置'}
                            </div>
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
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    保存设置
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        保存设置
                    </DialogTitle>
                    <DialogDescription>
                        配置截图和录像的保存位置
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">当前保存路径</label>
                        <div className="mt-1 p-2 bg-secondary rounded text-sm font-mono break-all">
                            {currentPath || '未设置'}
                        </div>
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
