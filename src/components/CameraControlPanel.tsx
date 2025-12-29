import { useState, useRef, useMemo, useEffect } from 'react';
import { Camera } from '@/types/camera';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { MjpegPlayer, MjpegPlayerRef } from '@/components/MjpegPlayer';
import { HlsPlayer, HlsPlayerRef } from '@/components/HlsPlayer';
import { FlvPlayer, FlvPlayerRef } from '@/components/FlvPlayer';
import { WebrtcPlayer, WebrtcPlayerRef } from '@/components/WebrtcPlayer';
import { VolumeControl } from '@/components/VolumeControl';
import { VideoRecorder } from '@/components/VideoRecorder';
import { useMotionDetector } from '@/hooks/useMotionDetector';
import { MotionEvent, addEventToStorage } from '@/components/MotionEventLog';
import { toast } from 'sonner';
import { captureScreenshot } from '@/components/ScreenshotControl';
import { saveScreenshot } from '@/utils/fileSaver';
import {
    Camera as CameraIcon,
    Video,
    Activity,
    Maximize2,
    X,
    Settings,
} from 'lucide-react';

interface CameraControlPanelProps {
    camera: Camera;
    onClose: () => void;
    onFullscreen: () => void;
    onToggleRecording?: (cameraId: string) => void;
}

export function CameraControlPanel({
    camera,
    onClose,
    onFullscreen,
    onToggleRecording,
}: CameraControlPanelProps) {
    const [isCapturing, setIsCapturing] = useState(false);

    // Player refs
    const mjpegRef = useRef<MjpegPlayerRef>(null);
    const hlsRef = useRef<HlsPlayerRef>(null);
    const flvRef = useRef<FlvPlayerRef>(null);
    const webrtcRef = useRef<WebrtcPlayerRef>(null);

    // 创建统一的媒体引用
    const mediaRef = useMemo(() => ({
        get current(): HTMLImageElement | HTMLVideoElement | null {
            if (camera.streamType === 'hls') {
                return hlsRef.current?.getVideoElement() || null;
            }
            if (camera.streamType === 'flv') {
                return flvRef.current?.getVideoElement() || null;
            }
            if (camera.streamType === 'webrtc') {
                return webrtcRef.current?.getVideoElement() || null;
            }
            return mjpegRef.current?.getImageElement() || null;
        }
    }), [camera.streamType]);

    // Motion detection callback
    const handleMotionEvent = (event: MotionEvent) => {
        addEventToStorage(event);
    };

    // Motion detector hook
    const motionDetector = useMotionDetector(mediaRef, camera.name, camera.id, {
        onMotionEvent: handleMotionEvent,
    });

    // Screenshot handler
    const handleScreenshot = async () => {
        setIsCapturing(true);
        try {
            const element = mediaRef.current;
            const result = await saveScreenshot(element, camera.name, '截图', '截图');
            if (result.success) {
                toast.success('截图已保存');
            } else {
                toast.error('截图失败');
            }
        } catch (error) {
            toast.error('截图失败');
        }
        setIsCapturing(false);
    };

    // Render the appropriate player
    const renderPlayer = () => {
        if (camera.streamType === 'hls' && camera.hlsUrl) {
            return <HlsPlayer ref={hlsRef} url={camera.hlsUrl} isOnline={camera.status === 'online'} />;
        }
        if (camera.streamType === 'flv' && camera.streamUrl) {
            return <FlvPlayer ref={flvRef} url={camera.streamUrl} isOnline={camera.status === 'online'} />;
        }
        if (camera.streamType === 'webrtc' && camera.webrtcUrl) {
            return <WebrtcPlayer ref={webrtcRef} url={camera.webrtcUrl} isOnline={camera.status === 'online'} streamId={camera.id.replace('cam-', '')} rtspUrl={camera.streamUrl} />;
        }
        return <MjpegPlayer ref={mjpegRef} url={camera.mjpegUrl} isOnline={camera.status === 'online'} />;
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${camera.status === 'online' ? 'bg-success' : 'bg-destructive'}`} />
                        {camera.name}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFullscreen}>
                            <Maximize2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col gap-4 p-4 pt-0 overflow-auto">
                {/* Video Preview */}
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    {renderPlayer()}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={handleScreenshot}
                        disabled={isCapturing || camera.status !== 'online'}
                    >
                        <CameraIcon className="w-4 h-4" />
                        截图
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onFullscreen}
                    >
                        <Maximize2 className="w-4 h-4" />
                    </Button>
                </div>

                {/* Video Recorder */}
                <div>
                    <VideoRecorder camera={camera} mediaRef={mediaRef} />
                </div>

                <Separator />

                {/* Volume Control (WebRTC only) */}
                {camera.streamType === 'webrtc' && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">音量控制</h4>
                        <VolumeControl
                            onVolumeChange={(vol) => webrtcRef.current?.setVolume(vol)}
                            onMuteToggle={(muted) => webrtcRef.current?.setMuted(muted)}
                        />
                    </div>
                )}

                <Separator />

                {/* Detection Controls */}
                <div className="space-y-3">
                    <h4 className="text-sm font-medium">智能侦测</h4>

                    {/* Motion Detection */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">移动侦测</span>
                            {motionDetector.motionDetected && (
                                <Badge variant="destructive" className="text-xs animate-pulse">
                                    检测到移动
                                </Badge>
                            )}
                        </div>
                        <Switch
                            checked={motionDetector.isDetecting}
                            onCheckedChange={motionDetector.toggleDetection}
                        />
                    </div>
                </div>

                <Separator />

                {/* Camera Info */}
                <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                        <span>分辨率</span>
                        <span className="font-mono">{camera.resolution}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>帧率</span>
                        <span className="font-mono">{camera.fps} fps</span>
                    </div>
                    <div className="flex justify-between">
                        <span>流类型</span>
                        <span className="font-mono uppercase">{camera.streamType}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>IP 地址</span>
                        <span className="font-mono">{camera.ipAddress}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
