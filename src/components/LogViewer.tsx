import React, { useEffect, useState, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, RefreshCw } from 'lucide-react';

export function LogViewer() {
    const [logs, setLogs] = useState<string>('');
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    const fetchLogs = async () => {
        // 浏览器环境：从后端 API 获取日志
        if (!isElectron) {
            setIsLoading(true);
            try {
                const response = await fetch('/api/logs');
                if (response.ok) {
                    const data = await response.json();
                    setLogs(data.logs || '暂无日志');
                } else {
                    // 如果 API 不存在，显示提示信息
                    setLogs('浏览器环境下日志功能有限。\n\n查看完整日志请使用:\ndocker logs -f ip-cam-web');
                }
            } catch (error) {
                setLogs('浏览器环境下日志功能有限。\n\n查看完整日志请使用:\ndocker logs -f ip-cam-web');
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // Electron 环境：使用 Electron API
        // @ts-ignore
        if (!window.electronAPI?.getAppLogs) {
            setLogs("Electron API not available");
            return;
        }
        setIsLoading(true);
        try {
            // @ts-ignore
            const content = await window.electronAPI.getAppLogs();
            setLogs(content);
        } catch (error) {
            setLogs(`Failed to fetch logs: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
            const interval = setInterval(fetchLogs, 3000); // Auto refresh every 3s
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    // Auto scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollElement) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
        }
    }, [logs]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" title="View Logs">
                    <FileText className="h-[1.2rem] w-[1.2rem]" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[800px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Application Logs</span>
                        <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </DialogTitle>
                    <DialogDescription>
                        Real-time logs from the main process (tail 50KB).
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 border rounded-md bg-slate-950 text-slate-50 font-mono text-xs p-4 overflow-hidden">
                    <ScrollArea className="h-[60vh] w-full" ref={scrollRef}>
                        <pre className="whitespace-pre-wrap break-all">
                            {logs || "No logs available."}
                        </pre>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
