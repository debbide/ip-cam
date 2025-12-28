import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import {
    ArrowLeft,
    Play,
    Trash2,
    Image,
    Video,
    User,
    Activity,
    RefreshCw,
    FolderOpen,
    Clock,
    HardDrive,
} from 'lucide-react';

interface SavedFile {
    name: string;
    path: string;
    size: number;
    created: Date;
    modified: Date;
    folder: string;
}

interface VideoPlaybackProps {
    onBack: () => void;
}

export function VideoPlayback({ onBack }: VideoPlaybackProps) {
    const [files, setFiles] = useState<{
        截图: SavedFile[];
        录像: SavedFile[];
        人形检测: SavedFile[];
        移动侦测: SavedFile[];
    }>({ 截图: [], 录像: [], 人形检测: [], 移动侦测: [] });
    const [loading, setLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState<SavedFile | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [deleteTarget, setDeleteTarget] = useState<SavedFile | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const loadFiles = async () => {
        if (!window.electronAPI) {
            toast.error('此功能仅在 Electron 客户端可用');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const result = await window.electronAPI.listSavedFiles();
            if (result.success && result.files) {
                setFiles(result.files);
            } else {
                toast.error('加载文件列表失败');
            }
        } catch (error) {
            console.error('Failed to load files:', error);
            toast.error('加载文件列表失败');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadFiles();
    }, []);

    const handlePreview = async (file: SavedFile) => {
        if (!window.electronAPI) return;

        try {
            const result = await window.electronAPI.getFileUrl(file.path);
            if (result.success && result.url) {
                setPreviewUrl(result.url);
                setSelectedFile(file);
            } else {
                toast.error('无法打开文件');
            }
        } catch (error) {
            toast.error('无法打开文件');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget || !window.electronAPI) return;

        try {
            const result = await window.electronAPI.deleteFile(deleteTarget.path);
            if (result.success) {
                toast.success('文件已删除');
                setDeleteTarget(null);
                loadFiles(); // 刷新列表
            } else {
                toast.error('删除失败: ' + result.error);
            }
        } catch (error) {
            toast.error('删除失败');
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const isVideo = (filename: string) => {
        return filename.endsWith('.webm') || filename.endsWith('.mp4') || filename.endsWith('.mkv');
    };

    const tabIcons = {
        截图: <Image className="w-4 h-4" />,
        录像: <Video className="w-4 h-4" />,
        人形检测: <User className="w-4 h-4" />,
        移动侦测: <Activity className="w-4 h-4" />,
    };

    const FileList = ({ items }: { items: SavedFile[] }) => {
        // 将 Windows 路径转换为 file:// URL
        const getFileUrl = (filePath: string) => {
            return `file:///${filePath.replace(/\\/g, '/')}`;
        };

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        暂无文件
                    </div>
                ) : (
                    items.map((file) => (
                        <div
                            key={file.path}
                            className="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all"
                        >
                            {/* 预览区域 */}
                            <div
                                className="aspect-video bg-muted flex items-center justify-center cursor-pointer relative overflow-hidden"
                                onClick={() => handlePreview(file)}
                            >
                                {isVideo(file.name) ? (
                                    // 视频显示播放图标
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                            <Play className="w-6 h-6 text-primary ml-0.5" />
                                        </div>
                                        <span className="text-xs">点击播放</span>
                                    </div>
                                ) : (
                                    // 图片显示实际缩略图
                                    <img
                                        src={getFileUrl(file.path)}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // 加载失败时显示图标
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement!.innerHTML = `
                                                <div class="flex flex-col items-center gap-2 text-muted-foreground">
                                                    <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                        <polyline points="21 15 16 10 5 21"></polyline>
                                                    </svg>
                                                    <span class="text-xs">点击查看</span>
                                                </div>
                                            `;
                                        }}
                                    />
                                )}
                            </div>

                            {/* 文件信息 */}
                            <div className="p-2">
                                <p className="text-xs font-medium truncate" title={file.name}>
                                    {file.name}
                                </p>
                                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDate(file.modified)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <HardDrive className="w-3 h-3" />
                                        {formatSize(file.size)}
                                    </span>
                                </div>
                            </div>

                            {/* 删除按钮 */}
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(file);
                                }}
                            >
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>
                    ))
                )}
            </div>
        );
    };

    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-card/50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-semibold">录像回放</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={loadFiles} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.electronAPI?.openSaveFolder()}
                    >
                        <FolderOpen className="w-4 h-4" />
                        打开文件夹
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-4">
                <Tabs defaultValue="录像" className="h-full flex flex-col">
                    <TabsList className="grid w-full max-w-md grid-cols-4 mb-4">
                        {(Object.keys(files) as Array<keyof typeof files>).map((folder) => (
                            <TabsTrigger key={folder} value={folder} className="gap-2">
                                {tabIcons[folder]}
                                <span className="hidden sm:inline">{folder}</span>
                                {files[folder].length > 0 && (
                                    <Badge variant="secondary" className="ml-1 text-xs">
                                        {files[folder].length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <ScrollArea className="flex-1">
                        {(Object.keys(files) as Array<keyof typeof files>).map((folder) => (
                            <TabsContent key={folder} value={folder} className="mt-0">
                                <FileList items={files[folder]} />
                            </TabsContent>
                        ))}
                    </ScrollArea>
                </Tabs>
            </div>

            {/* Preview Dialog */}
            <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8">{selectedFile?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center bg-black rounded-lg overflow-hidden">
                        {selectedFile && isVideo(selectedFile.name) ? (
                            <video
                                ref={videoRef}
                                src={previewUrl}
                                controls
                                autoPlay
                                className="max-w-full max-h-[70vh]"
                                onError={(e) => {
                                    const target = e.target as HTMLVideoElement;
                                    console.error('Video Error:', target.error);
                                    toast.error(`播放失败: ${target.error?.message || '未知错误'} (Code: ${target.error?.code})`);
                                }}
                                onLoadedMetadata={(e) => {
                                    const target = e.target as HTMLVideoElement;
                                    if (target.duration === Infinity) {
                                        // Fix for WebM duration
                                        target.currentTime = 1e101;
                                        target.ontimeupdate = function () {
                                            this.currentTime = 0;
                                            this.ontimeupdate = null;
                                        };
                                    }
                                }}
                            />
                        ) : (
                            <img
                                src={previewUrl}
                                alt={selectedFile?.name}
                                className="max-w-full max-h-[70vh] object-contain"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除文件 "{deleteTarget?.name}" 吗？此操作无法撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
