import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { VideoOff, RefreshCw, WifiOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WebrtcPlayerProps {
    url: string; // WHEP URL
    isOnline: boolean;
    className?: string;
    isFullscreen?: boolean;
    rotation?: number;
    initialMuted?: boolean;
    password?: string;
}

export interface WebrtcPlayerRef {
    getVideoElement: () => HTMLVideoElement | null;
    setVolume: (volume: number) => void;
    setMuted: (muted: boolean) => void;
    isMuted: () => boolean;
    getVolume: () => number;
}

export const WebrtcPlayer = forwardRef<WebrtcPlayerRef, WebrtcPlayerProps>(({ url, isOnline, className = '', isFullscreen = false, rotation = 0, initialMuted = true, password }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const streamRef = useRef<MediaStream | null>(null); // 保存 MediaStream 引用
    const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
    const [isMuted, setIsMuted] = useState(initialMuted); // 使用 initialMuted 初始化
    const [retryCount, setRetryCount] = useState(0);
    const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
    const retryCountRef = useRef(0); // 用于闭包中获取最新值
    // 无限重试：前 10 次每 2 秒，之后每 5 秒
    const getRetryInterval = (count: number) => count < 10 ? 2000 : 5000;
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

    // 监听视频元素状态
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePause = () => console.log('[WebRTC] Video paused');
        const handlePlay = () => console.log('[WebRTC] Video playing');
        const handleSuspend = () => console.log('[WebRTC] Video suspended');
        const handleStalled = () => console.log('[WebRTC] Video stalled');

        video.addEventListener('pause', handlePause);
        video.addEventListener('play', handlePlay);
        video.addEventListener('suspend', handleSuspend);
        video.addEventListener('stalled', handleStalled);

        return () => {
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('suspend', handleSuspend);
            video.removeEventListener('stalled', handleStalled);
        };
    }, []);

    // 同步 muted 状态到 video 元素
    useEffect(() => {
        if (videoRef.current) {
            console.log(`[WebRTC] Syncing muted state: ${isMuted}`);
            videoRef.current.muted = isMuted;
            videoRef.current.volume = 1.0;
        }
    }, [isMuted]);

    const [volume, setVolume] = useState(1.0);

    useImperativeHandle(ref, () => ({
        getVideoElement: () => videoRef.current,
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

    // 自动重试函数（无限重试）
    const scheduleRetry = () => {
        if (isOnline) {
            const interval = getRetryInterval(retryCountRef.current);
            retryTimerRef.current = setTimeout(() => {
                setRetryCount(prev => prev + 1);
            }, interval);
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
                    console.log(`[WebRTC] Received track: ${event.track.kind}, id: ${event.track.id}, label: ${event.track.label}, enabled: ${event.track.enabled}, muted: ${event.track.muted}`);

                    if (videoRef.current) {
                        console.log(`[WebRTC] Video element state - muted: ${videoRef.current.muted}, volume: ${videoRef.current.volume}, paused: ${videoRef.current.paused}`);
                    }

                    // 监听轨道静音状态变化
                    event.track.onmute = () => {
                        console.log(`[WebRTC] Track muted: ${event.track.kind}`);
                    };
                    event.track.onunmute = () => {
                        console.log(`[WebRTC] Track unmuted: ${event.track.kind}`);
                    };
                    // 回滚：始终手动构建流，确保兼容性
                    if (!streamRef.current) {
                        streamRef.current = new MediaStream();
                    }
                    streamRef.current.addTrack(event.track);

                    // 强制刷新 video.srcObject
                    if (videoRef.current) {
                        console.log(`[WebRTC] refreshing video srcObject for track: ${event.track.kind}`);
                        // 创建新的 MediaStream 对象以触发 React/DOM 更新
                        const newStream = new MediaStream(streamRef.current.getTracks());
                        videoRef.current.srcObject = newStream;

                        // 尝试播放
                        videoRef.current.play().catch(e => console.error('[WebRTC] Play error:', e));
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

                const headers: HeadersInit = {
                    'Content-Type': 'application/sdp'
                };

                if (password) {
                    headers['Authorization'] = 'Basic ' + btoa(`viewer:${password}`);
                }

                const response = await fetch(whepUrl, {
                    method: 'POST',
                    body: offer.sdp,
                    headers: headers
                });

                if (!response.ok) {
                    throw new Error(`WHEP error: ${response.status}`);
                }

                setDebugInfo(prev => ({ ...prev, step: 'processing_answer' }));
                let answer = await response.text();

                // SDP Rewrite: 始终重写 Docker 内部 IP (172.x.x.x) 到实际连接的主机
                // 无论是浏览器还是 Electron，连接 Docker 容器都需要这个重写
                const whepUrlObj = new URL(whepUrl);
                const targetHost = whepUrlObj.hostname === 'localhost' ? '127.0.0.1' : whepUrlObj.hostname;
                answer = answer.replace(/(a=candidate:\S+ \d+ \w+ \d+ )(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})( \d+ typ)/g, (match, prefix, ip, suffix) => {
                    // 只替换 Docker 内部 IP (172.x.x.x, 10.x.x.x)
                    if (ip.startsWith('172.') || ip.startsWith('10.')) {
                        return `${prefix}${targetHost}${suffix}`;
                    }
                    return match;
                });

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
                let audioStats: any = null;

                report.forEach(stat => {
                    if (stat.type === 'inbound-rtp') {
                        console.log(`[WebRTC] Inbound RTP (${stat.kind}):`, stat);
                        if (stat.kind === 'video') videoStats = stat;
                        if (stat.kind === 'audio') audioStats = stat;
                    }
                });

                if (audioStats) {
                    console.log(`[WebRTC] Audio stats: bytesReceived=${audioStats.bytesReceived}, packetsReceived=${audioStats.packetsReceived}, codecId=${audioStats.codecId}`);
                } else {
                    console.log('[WebRTC] No audio stats found in report');
                }

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
                muted={true} // 强制静音以确保自动播放
                autoPlay
                playsInline
                onLoadedMetadata={(e) => {
                    console.log('[WebRTC] Video metadata loaded, attempting to play');
                    const video = e.currentTarget;
                    video.play()
                        .then(() => {
                            console.log('[WebRTC] Playback started');
                            // 如果状态要求非静音，则在播放成功后取消静音
                            if (!isMuted) {
                                video.muted = false;
                            }
                        })
                        .catch(err => console.error('[WebRTC] Play failed on metadata load:', err));
                }}
            />

            {/* Loading State */}
            {status === 'loading' && isOnline && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80 z-10">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <span className="text-primary text-sm font-mono">
                        {retryCount > 0 ? `连接中 (第 ${retryCount} 次)` : '连接中...'}
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
                    ) : (
                        <>
                            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-orange-500 text-sm font-mono">等待流就绪...</span>
                            <span className="text-muted-foreground text-xs font-mono mt-1">
                                自动重连中 (第 {retryCount} 次)
                            </span>
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
