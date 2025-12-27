import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mpegts from 'mpegts.js';
import { VideoOff, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FlvPlayerProps {
    url: string; // RTSP URL, will be converted to FLV API URL
    isOnline: boolean;
    className?: string;
    rotation?: number;
}

export interface FlvPlayerRef {
    getVideoElement: () => HTMLVideoElement | null;
}

export const FlvPlayer = forwardRef<FlvPlayerRef, FlvPlayerProps>(({ url, isOnline, className = '', rotation = 0 }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<mpegts.Player | null>(null);
    const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
    const [retryCount, setRetryCount] = useState(0);

    useImperativeHandle(ref, () => ({
        getVideoElement: () => videoRef.current,
    }));

    useEffect(() => {
        if (!isOnline) {
            setStatus('error');
            destroyPlayer();
            return;
        }

        if (!url) return;

        // Construct FLV API URL
        // Assuming the backend is on the same host but port 3001 (or proxied)
        // In dev, we use localhost:3001. In prod, we might need a relative path if proxied.
        // For now, let's assume direct access to API port or proxy.
        // Since we are in docker, the browser accesses localhost:3001 directly for now.
        const flvUrl = `http://${window.location.hostname}:3001/api/stream/flv?url=${encodeURIComponent(url)}`;

        const initPlayer = () => {
            if (mpegts.getFeatureList().mseLivePlayback) {
                destroyPlayer();

                const player = mpegts.createPlayer({
                    type: 'flv',
                    isLive: true,
                    url: flvUrl,
                    hasAudio: true,
                }, {
                    enableWorker: true,
                    lazyLoadMaxDuration: 3 * 60,
                    seekType: 'range',
                    liveBufferLatencyChasing: true, // 追赶延迟
                    liveBufferLatencyMaxLatency: 1.5, // 最大允许延迟 1.5s
                    liveBufferLatencyMinRemain: 0.3, // 最小保留缓冲 0.3s
                });

                player.attachMediaElement(videoRef.current!);
                player.load();

                player.on(mpegts.Events.ERROR, (e) => {
                    console.error('FLV Error:', e);
                    setStatus('error');
                });

                player.on(mpegts.Events.LOADING_COMPLETE, () => {
                    // Live stream usually doesn't complete
                });

                const playPromise = player.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        setStatus('connected');
                    }).catch(e => {
                        console.error('FLV Play Error:', e);
                        setStatus('error');
                    });
                } else {
                    setStatus('connected');
                }

                playerRef.current = player;
            } else {
                console.error('MSE not supported');
                setStatus('error');
            }
        };

        setStatus('loading');
        initPlayer();

        return () => {
            destroyPlayer();
        };
    }, [url, isOnline, retryCount]);

    const destroyPlayer = () => {
        if (playerRef.current) {
            playerRef.current.destroy();
            playerRef.current = null;
        }
    };

    const handleRetry = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRetryCount(prev => prev + 1);
    };

    return (
        <div className={`relative w-full h-full bg-black overflow-hidden ${className}`}>
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80 z-10">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <span className="text-primary text-sm font-mono">连接中...</span>
                    <span className="text-muted-foreground text-xs font-mono mt-1">Low Latency FLV</span>
                </div>
            )}

            {/* Error / Offline State */}
            {(status === 'error' || !isOnline) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80 z-10">
                    {!isOnline ? (
                        <>
                            <WifiOff className="w-10 h-10 text-destructive/60 mb-3" />
                            <span className="text-destructive/80 text-sm font-mono">设备离线</span>
                        </>
                    ) : (
                        <>
                            <VideoOff className="w-10 h-10 text-muted-foreground/60 mb-3" />
                            <span className="text-muted-foreground text-sm font-mono mb-3">连接断开</span>
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
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-background/60 rounded text-xs font-mono z-20 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-blue-500 font-bold">FLV</span>
                </div>
            )}
        </div>
    );
});

FlvPlayer.displayName = 'FlvPlayer';
