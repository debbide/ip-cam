import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { VideoOff, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';

interface HlsPlayerProps {
    url: string;
    isOnline: boolean;
    className?: string;
    rotation?: number;
    streamId?: string; // 用于重新注册流
    rtspUrl?: string;  // 源 RTSP URL，用于重新注册
}

export interface HlsPlayerRef {
    getVideoElement: () => HTMLVideoElement | null;
}

export const HlsPlayer = forwardRef<HlsPlayerRef, HlsPlayerProps>(({ url, isOnline, className = '', rotation = 0, streamId, rtspUrl }, ref) => {
    const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
    const [retryCount, setRetryCount] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
    const retryCountRef = useRef(0);
    const maxRetries = 30; // 最大重试次数
    const reRegisterInterval = 5; // 每5次重试，尝试重新注册流

    // 同步 ref
    useEffect(() => {
        retryCountRef.current = retryCount;
    }, [retryCount]);

    // 重新注册流到后端（不删除已存在的流）
    const reRegisterStream = async () => {
        if (!streamId || !rtspUrl) return false;

        try {
            console.log(`[HLS] Checking/registering stream: ${streamId}`);

            // 直接尝试添加流（如果已存在会返回错误，没关系）
            const response = await fetch('/api/streams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: streamId, rtspUrl }),
            });

            if (response.ok) {
                console.log(`[HLS] Stream ${streamId} registered successfully`);
                return true;
            } else {
                // 流可能已存在，这是正常的
                console.log(`[HLS] Stream ${streamId} may already exist`);
                return true;
            }
        } catch (error) {
            console.error(`[HLS] Failed to register stream:`, error);
            return false;
        }
    };

    // 自动重试函数
    const scheduleRetry = async () => {
        if (!isOnline) return;

        const currentRetry = retryCountRef.current;
        if (currentRetry >= maxRetries) return; // 超过最大重试次数

        // 每5次重试，尝试重新注册流
        if (currentRetry > 0 && currentRetry % reRegisterInterval === 0 && streamId && rtspUrl) {
            console.log(`[HLS] Retry #${currentRetry}, attempting to re-register stream...`);
            await reRegisterStream();
            // 重新注册后等待更长时间让 FFmpeg 启动
            retryTimerRef.current = setTimeout(() => {
                setRetryCount(prev => prev + 1);
            }, 3000);
        } else {
            // 前10次每3秒，之后每5秒
            const interval = currentRetry < 10 ? 3000 : 5000;
            retryTimerRef.current = setTimeout(() => {
                setRetryCount(prev => prev + 1);
            }, interval);
        }
    };

    useImperativeHandle(ref, () => ({
        getVideoElement: () => videoRef.current,
    }));

    useEffect(() => {
        // 清理重试定时器
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }

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

        setStatus('loading');

        // 延迟加载，等待 HLS 文件生成
        const loadHls = () => {
            // 检查原生 HLS 支持（Safari）
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
                video.addEventListener('loadedmetadata', () => {
                    setStatus('connected');
                    setRetryCount(0); // 连接成功，重置重试计数
                });
                video.addEventListener('error', () => {
                    setStatus('error');
                    scheduleRetry(); // 自动重试
                });
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
                    setRetryCount(0); // 连接成功，重置重试计数
                    video.play().catch(() => { });
                });

                hls.on(Hls.Events.ERROR, (_, data) => {
                    if (data.fatal) {
                        console.error('HLS fatal error:', data);
                        setStatus('error');
                        scheduleRetry(); // 自动重试
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
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
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
                crossOrigin="anonymous"
            />

            {/* Loading State */}
            {status === 'loading' && isOnline && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <span className="text-primary text-sm font-mono">
                        {retryCount > 0 ? `重试中 (${retryCount}/${maxRetries})` : '连接中...'}
                    </span>
                    <span className="text-muted-foreground text-xs font-mono mt-1">HLS Stream</span>
                </div>
            )}

            {/* Error / Offline State */}
            {(status === 'error' || !isOnline) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80 z-30">
                    {!isOnline ? (
                        <>
                            <WifiOff className="w-10 h-10 text-destructive/60 mb-3" />
                            <span className="text-destructive/80 text-sm font-mono">设备离线</span>
                        </>
                    ) : retryCount < maxRetries ? (
                        <>
                            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-orange-500 text-sm font-mono">等待流就绪...</span>
                            <span className="text-muted-foreground text-xs font-mono mt-1">
                                自动重试 ({retryCount}/{maxRetries})
                            </span>
                        </>
                    ) : (
                        <>
                            <VideoOff className="w-10 h-10 text-muted-foreground/60 mb-3" />
                            <span className="text-muted-foreground text-sm font-mono mb-3">连接失败</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRetry}
                                className="gap-2 text-xs"
                            >
                                <RefreshCw className="w-3 h-3" />
                                重试连接
                            </Button>
                        </>
                    )}
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
