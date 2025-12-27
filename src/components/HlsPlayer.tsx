import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { VideoOff, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';

interface HlsPlayerProps {
    url: string;
    isOnline: boolean;
    className?: string;
    rotation?: number;
}

export interface HlsPlayerRef {
    getVideoElement: () => HTMLVideoElement | null;
}

export const HlsPlayer = forwardRef<HlsPlayerRef, HlsPlayerProps>(({ url, isOnline, className = '', rotation = 0 }, ref) => {
    const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
    const [retryCount, setRetryCount] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    useImperativeHandle(ref, () => ({
        getVideoElement: () => videoRef.current,
    }));

    useEffect(() => {
        if (!isOnline || !url) {
            setStatus('error');
            return;
        }

        const video = videoRef.current;
        if (!video) return;

        // 清理旧实例
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        // 延迟加载，等待 HLS 文件生成
        const loadHls = () => {
            // 检查原生 HLS 支持（Safari）
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
                video.addEventListener('loadedmetadata', () => setStatus('connected'));
                video.addEventListener('error', () => setStatus('error'));
                video.play().catch(() => { });
                return;
            }

            // 使用 hls.js
            if (Hls.isSupported()) {
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 90,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                    liveSyncDurationCount: 1, // 尝试保持在最后 1 个切片
                    liveMaxLatencyDurationCount: 3, // 最大允许落后 3 个切片
                    liveDurationInfinity: true,
                });

                hls.loadSource(url);
                hls.attachMedia(video);

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    setStatus('connected');
                    video.play().catch(() => { });
                });

                hls.on(Hls.Events.ERROR, (_, data) => {
                    if (data.fatal) {
                        console.error('HLS fatal error:', data);
                        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                            // 网络错误，3秒后自动重试
                            setTimeout(() => {
                                hls.startLoad();
                            }, 3000);
                        } else {
                            setStatus('error');
                        }
                    }
                });

                hlsRef.current = hls;
            } else {
                setStatus('error');
            }
        };

        // 延迟 2 秒开始加载，给转码服务时间生成 HLS 文件
        const timer = setTimeout(loadHls, 2000);

        return () => {
            clearTimeout(timer);
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [url, isOnline, retryCount]);

    const handleRetry = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRetryCount(prev => prev + 1);
        setStatus('loading');
    };

    return (
        <div className={`relative w-full h-full bg-secondary/50 overflow-hidden ${className}`}>
            {/* Scanline overlay */}
            <div className="absolute inset-0 scanline opacity-20 pointer-events-none z-10" />

            {/* Corner brackets */}
            <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-primary/50" />
                <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-primary/50" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-primary/50" />
                <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-primary/50" />
            </div>

            {/* HLS Video - 始终渲染，通过 CSS 控制可见性 */}
            <video
                ref={videoRef}
                className={`w-full h-full object-cover transition-transform duration-300 ${status === 'connected' ? '' : 'invisible'}`}
                style={{ transform: `rotate(${rotation}deg)` }}
                muted
                autoPlay
                playsInline
            />

            {/* Loading State */}
            {status === 'loading' && isOnline && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <span className="text-primary text-sm font-mono">连接中...</span>
                    <span className="text-muted-foreground text-xs font-mono mt-1">HLS Stream</span>
                </div>
            )}

            {/* Error / Offline State */}
            {(status === 'error' || !isOnline) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80 z-30">
                    <VideoOff className="w-10 h-10 text-muted-foreground/60 mb-3" />
                    <span className="text-muted-foreground text-sm font-mono mb-3">
                        {!isOnline ? '设备离线' : '无法连接视频流'}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetry}
                        className="gap-2 text-xs"
                    >
                        <RefreshCw className="w-3 h-3" />
                        重试连接
                    </Button>
                </div>
            )}

            {/* Connection indicator */}
            {status === 'connected' && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-background/60 rounded text-xs font-mono z-20">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span className="text-success">LIVE</span>
                </div>
            )}
        </div>
    );
});

HlsPlayer.displayName = 'HlsPlayer';
