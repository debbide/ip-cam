import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { VideoOff, RefreshCw, WifiOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WebrtcPlayerProps {
    url: string; // WHEP URL
    isOnline: boolean;
    className?: string;
    isFullscreen?: boolean;
    rotation?: number;
}

export interface WebrtcPlayerRef {
    getVideoElement: () => HTMLVideoElement | null;
    getMediaStream: () => MediaStream | null;
    setVolume: (volume: number) => void;
    setMuted: (muted: boolean) => void;
    isMuted: () => boolean;
    getVolume: () => number;
}

export const WebrtcPlayer = forwardRef<WebrtcPlayerRef, WebrtcPlayerProps>(({ url, isOnline, className = '', isFullscreen = false, rotation = 0 }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const streamRef = useRef<MediaStream | null>(null); // 保存 MediaStream 引用
    const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
    const [isMuted, setIsMuted] = useState(true); // 默认静音以支持自动播放
    const [retryCount, setRetryCount] = useState(0);
    const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
    const retryCountRef = useRef(0); // 用于闭包中获取最新值
    const maxRetries = 30; // 最多重试30次，每次2秒，共60秒
    const retryInterval = 2000; // 2秒重试一次
    const [debugInfo, setDebugInfo] = useState({
        iceConnection: 'new',
        iceGathering: 'new',
        signaling: 'stable',
        step: 'init'
    });

    // 同步 ref
    useEffect(() => {
        retryCountRef.current = retryCount;
    }, [retryCount]);

    // 同步 muted 状态到 video 元素
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
            videoRef.current.volume = 1.0;

        }
    }, [isMuted]);

    const [volume, setVolume] = useState(1.0);

    useImperativeHandle(ref, () => ({
        getVideoElement: () => videoRef.current,
        getMediaStream: () => streamRef.current,
        setVolume: (vol: number) => {
            const clampedVol = Math.max(0, Math.min(1, vol));
            setVolume(clampedVol);
            if (videoRef.current) {
                videoRef.current.volume = clampedVol;
                if (clampedVol > 0 && isMuted) {
                    setIsMuted(false);
                    videoRef.current.muted = false;
                }
            }
        },
        setMuted: (muted: boolean) => {
            setIsMuted(muted);
            if (videoRef.current) {
                videoRef.current.muted = muted;
            }
        },
        isMuted: () => isMuted,
        getVolume: () => volume,
    }));

    const destroyPeerConnection = () => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        streamRef.current = null;
    };

    // 自动重试函数
    const scheduleRetry = () => {
        if (retryCountRef.current < maxRetries && isOnline) {
            // console.log(`[WebRTC] 将在 ${retryInterval / 1000} 秒后重试 (${retryCountRef.current + 1}/${maxRetries})`);
            retryTimerRef.current = setTimeout(() => {
                setRetryCount(prev => prev + 1);
            }, retryInterval);
        }
    };

    useEffect(() => {
        if (!isOnline) {
            setStatus('error');
            destroyPeerConnection();
            return;
        }

        if (!url) return;

        // Handle relative URLs by prepending origin
        let whepUrl = url;
        if (url.startsWith('/')) {
            whepUrl = window.location.origin + url;
        } else {
            try {
                const urlObj = new URL(url);
                if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
                    urlObj.hostname = window.location.hostname;
                    whepUrl = urlObj.toString();
                }
            } catch (e) {
                console.error('Invalid URL:', url);
            }
        }

        // 检查 URL 格式并自动补全 /whep 后缀（兼容旧配置）
        // 新格式: /whep/{streamId} - 不需要补全
        // 旧格式: http://host:8889/{streamId} - 需要补全 /whep
        if (!whepUrl.includes('/whep')) {
            whepUrl = whepUrl.replace(/\/?$/, '/whep');
        }

        const initPlayer = async () => {
            try {
                if (typeof RTCPeerConnection === 'undefined') {
                    throw new Error('WebRTC not supported (requires HTTPS or localhost)');
                }

                destroyPeerConnection();

                const pc = new RTCPeerConnection({
                    iceServers: []
                });
                pcRef.current = pc;

                pc.addTransceiver('video', { direction: 'recvonly' });
                pc.addTransceiver('audio', { direction: 'recvonly' });

                pc.ontrack = (event) => {


                    // 创建或获取 MediaStream
                    if (!streamRef.current) {
                        streamRef.current = new MediaStream();
                    }

                    // 添加轨道到流
                    streamRef.current.addTrack(event.track);

                    // 设置到视频元素
                    if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
                        videoRef.current.srcObject = streamRef.current;
                    }

                    setStatus('connected');
                };

                pc.onconnectionstatechange = () => {
                    setDebugInfo(prev => ({ ...prev, iceConnection: pc.connectionState }));
                    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                        setStatus('error');
                        scheduleRetry(); // 自动重试
                    } else if (pc.connectionState === 'connected') {
                        setStatus('connected');
                        // 连接成功，重置重试计数
                        setRetryCount(0);
                    }
                };

                pc.onicegatheringstatechange = () => {
                    setDebugInfo(prev => ({ ...prev, iceGathering: pc.iceGatheringState }));
                };

                pc.onsignalingstatechange = () => {
                    setDebugInfo(prev => ({ ...prev, signaling: pc.signalingState }));
                };

                setDebugInfo(prev => ({ ...prev, step: 'creating_offer' }));
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                setDebugInfo(prev => ({ ...prev, step: 'fetching_sdp' }));
                const response = await fetch(whepUrl, {
                    method: 'POST',
                    body: offer.sdp,
                    headers: {
                        'Content-Type': 'application/sdp'
                    }
                });

                if (!response.ok) {
                    throw new Error(`WHEP error: ${response.status}`);
                }

                setDebugInfo(prev => ({ ...prev, step: 'processing_answer' }));
                let answer = await response.text();

                // SDP Rewrite: 只在 Docker 环境下重写（非 Electron 桌面应用）
                // Electron 桌面应用不需要重写，因为 MediaMTX 在本地运行
                const isElectron = navigator.userAgent.includes('Electron');
                if (!isElectron) {
                    const currentHost = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
                    answer = answer.replace(/(a=candidate:\S+ \d+ \w+ \d+ )(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})( \d+ typ)/g, (match, prefix, ip, suffix) => {
                        // 只替换 Docker 内部 IP (172.x.x.x)
                        if (ip.startsWith('172.')) {
                            return `${prefix}${currentHost}${suffix}`;
                        }
                        return match;
                    });
                } else {
                    // console.log('[WebRTC] Electron 环境，跳过 SDP 重写');
                }

                await pc.setRemoteDescription({
                    type: 'answer',
                    sdp: answer
                });

                setDebugInfo(prev => ({ ...prev, step: 'done' }));

            } catch (err: any) {
                // console.error('WebRTC Error:', err);
                setStatus('error');
                setDebugInfo(prev => ({ ...prev, step: `error: ${err.message}` }));
                scheduleRetry(); // 自动重试
            }
        };

        setStatus('loading');
        initPlayer();

        return () => {
            destroyPeerConnection();
        };
    }, [url, isOnline, retryCount]);

    const handleRetry = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRetryCount(0); // 重置重试计数，重新开始
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (videoRef.current) {
            const newMuted = !isMuted;
            videoRef.current.muted = newMuted;
            videoRef.current.volume = 1.0; // 确保音量最大
            setIsMuted(newMuted);

            // 检查音频轨道
            if (streamRef.current) {
                const audioTracks = streamRef.current.getAudioTracks();
                audioTracks.forEach((track, i) => {
                    // console.log(`[WebRTC] Audio track ${i}:`, track.kind, track.label, 'enabled:', track.enabled, 'muted:', track.muted);
                });
            }
        }
    };

    // 实时统计信息
    const [stats, setStats] = useState({ fps: 0, bitrate: '0.0 Mbps' });
    const [currentTime, setCurrentTime] = useState('');
    const lastStatsRef = useRef<{ timestamp: number; bytesReceived: number; framesDecoded: number } | null>(null);

    // 更新时间戳
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(/\//g, '-');
            setCurrentTime(timeString);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (status !== 'connected' || !pcRef.current) return;

        const intervalId = setInterval(async () => {
            if (!pcRef.current) return;

            try {
                const report = await pcRef.current.getStats();
                let videoStats: any = null;

                report.forEach(stat => {
                    if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
                        videoStats = stat;
                    }
                });

                if (videoStats) {
                    const now = videoStats.timestamp;
                    const bytesReceived = videoStats.bytesReceived;
                    const framesDecoded = videoStats.framesDecoded;

                    if (lastStatsRef.current) {
                        const duration = (now - lastStatsRef.current.timestamp) / 1000; // 秒
                        if (duration > 0) {
                            // 计算码率 (Mbps)
                            const bytes = bytesReceived - lastStatsRef.current.bytesReceived;
                            const bits = bytes * 8;
                            const mbps = (bits / duration / 1000000).toFixed(2);

                            // 计算 FPS
                            const frames = framesDecoded - lastStatsRef.current.framesDecoded;
                            const fps = Math.round(frames / duration);

                            setStats({ fps, bitrate: `${mbps} Mbps` });
                        }
                    }

                    lastStatsRef.current = { timestamp: now, bytesReceived, framesDecoded };
                }
            } catch (e) {
                console.error('Failed to get stats:', e);
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [status]);

    return (
        <div className={`relative w-full h-full bg-black overflow-hidden ${className}`}>
            <video
                ref={videoRef}
                className={`w-full h-full object-cover transition-transform duration-300 ${status === 'connected' ? '' : 'invisible'}`}
                style={{ transform: `rotate(${rotation}deg)` }}
                muted={isMuted}
                autoPlay
                playsInline
                controls={false}
                crossOrigin="anonymous"
            />

            {/* Loading State */}
            {status === 'loading' && isOnline && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80 z-10">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <span className="text-primary text-sm font-mono">
                        {retryCount > 0 ? `重试中 (${retryCount}/${maxRetries})` : '连接中...'}
                    </span>
                    <span className="text-muted-foreground text-xs font-mono mt-1">WebRTC (WHEP)</span>
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

            {/* Connection indicator & Real-time Stats */}
            {status === 'connected' && (
                <>
                    {/* Timestamp Overlay (Top Right - Classic CCTV Style) */}
                    <div className="absolute top-4 right-4 z-20 pointer-events-none">
                        <div className={`${isFullscreen ? 'text-xl' : 'text-xs'} font-mono font-bold text-white tracking-wider`} style={{ textShadow: '1px 1px 1px black' }}>
                            {currentTime}
                        </div>
                    </div>

                    {/* Stats & Protocol (Bottom Left - Vertical Stack) */}
                    <div className="absolute bottom-4 left-4 flex flex-col items-start gap-1 z-20 pointer-events-none">
                        {/* LIVE Indicator */}


                        {/* Stats Stack */}
                        <div className="flex flex-col gap-0.5 text-[10px] font-mono text-white/70" style={{ textShadow: '1px 1px 1px black' }}>
                            <span>{stats.fps} FPS</span>
                            <span>{stats.bitrate}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
});

WebrtcPlayer.displayName = 'WebrtcPlayer';
