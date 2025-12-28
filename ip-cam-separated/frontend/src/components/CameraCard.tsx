import { useRef, useEffect, useMemo, useState } from 'react';
import { Camera } from '@/types/camera';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MjpegPlayer, MjpegPlayerRef } from '@/components/MjpegPlayer';
import { HlsPlayer, HlsPlayerRef } from '@/components/HlsPlayer';
import { FlvPlayer, FlvPlayerRef } from '@/components/FlvPlayer';
import { WebrtcPlayer, WebrtcPlayerRef } from '@/components/WebrtcPlayer';
import { AudioPlayer } from '@/components/AudioPlayer';
import { VolumeControl } from '@/components/VolumeControl';
import { RecordingBadge } from '@/components/RecordingControl';
import { useHumanDetector } from '@/hooks/useHumanDetector';
import { saveScreenshot } from '@/utils/fileSaver';
import { toast } from 'sonner';
import {
  Video,
  VideoOff,
  Maximize2,
  Settings,
  User,
  UserCheck,
  Camera as CameraIcon,
  Circle,
  Square,
  RotateCw,
} from 'lucide-react';

interface CameraCardProps {
  camera: Camera;
  isSelected?: boolean;
  onSelect?: (camera: Camera) => void;
  onFullscreen?: (camera: Camera) => void;
  onToggleRecording?: (cameraId: string) => void;
  onEditDevice?: (camera: Camera) => void;
  onRotate?: (camera: Camera) => void;
}

export function CameraCard({ camera, isSelected, onSelect, onFullscreen, onToggleRecording, onEditDevice, onRotate }: CameraCardProps) {
  const webrtcRef = useRef<WebrtcPlayerRef>(null);
  const hlsRef = useRef<HlsPlayerRef>(null);
  const flvRef = useRef<FlvPlayerRef>(null);
  const mjpegRef = useRef<MjpegPlayerRef>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // 创建 video ref 用于人形检测
  const videoRef = useMemo(() => ({
    get current(): HTMLVideoElement | null {
      if (camera.streamType === 'hls') {
        return hlsRef.current?.getVideoElement() || null;
      }
      if (camera.streamType === 'flv') {
        return flvRef.current?.getVideoElement() || null;
      }
      if (camera.streamType === 'webrtc') {
        return webrtcRef.current?.getVideoElement() || null;
      }
      return null; // MJPEG 是图片，不支持
    }
  }), [camera.streamType]);

  // 创建媒体元素引用（用于截图）
  const getMediaElement = (): HTMLImageElement | HTMLVideoElement | null => {
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
  };

  // 直接使用 useHumanDetector hook
  const humanDetector = useHumanDetector(videoRef, camera.name, camera.id, {
    detectionRegion: camera.humanDetectionRegion
  });

  // 记录配置中的 humanDetectionEnabled 上一次的值
  const prevEnabledRef = useRef(camera.humanDetectionEnabled);

  // 当配置中 humanDetectionEnabled 为 true 且在线时，自动启动检测
  // 当配置中 humanDetectionEnabled 从 true 变为 false 时，自动停止检测
  useEffect(() => {
    if (camera.streamType === 'mjpeg') return; // MJPEG 不支持

    const wasEnabled = prevEnabledRef.current;
    const isEnabled = camera.humanDetectionEnabled;
    prevEnabledRef.current = isEnabled;

    // 配置从关闭变为开启：自动启动检测
    if (isEnabled && !wasEnabled && camera.status === 'online' && !humanDetector.isDetecting) {
      const timer = setTimeout(() => {
        if (videoRef.current && !humanDetector.isDetecting) {
          console.log(`[CameraCard] Auto-starting detection for ${camera.name} (config enabled)`);
          humanDetector.startDetection();
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    // 配置从开启变为关闭：自动停止检测
    if (!isEnabled && wasEnabled && humanDetector.isDetecting) {
      console.log(`[CameraCard] Auto-stopping detection for ${camera.name} (config disabled)`);
      humanDetector.stopDetection();
    }
  }, [camera.humanDetectionEnabled, camera.status, camera.streamType, camera.name]);

  const statusColors = {
    online: 'bg-success glow-success',
    offline: 'bg-destructive glow-destructive',
    connecting: 'bg-warning glow-warning animate-pulse',
  };

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFullscreen?.(camera);
  };

  const handleRecordingClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleRecording?.(camera.id);
  };

  // 截图处理
  const handleScreenshot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCapturing(true);
    try {
      const element = getMediaElement();
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

  // 人形检测开关
  const handleToggleHumanDetection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (camera.streamType === 'mjpeg') {
      toast.error('MJPEG 流不支持人形检测');
      return;
    }
    humanDetector.toggleDetection();
  };

  // 根据 streamType 选择播放器
  const renderPlayer = () => {
    if (camera.streamType === 'hls' && camera.hlsUrl) {
      return (
        <HlsPlayer
          ref={hlsRef}
          url={camera.hlsUrl}
          isOnline={camera.status === 'online'}
          rotation={camera.rotation || 0}
        />
      );
    }
    if (camera.streamType === 'flv' && camera.streamUrl) {
      return (
        <FlvPlayer
          ref={flvRef}
          url={camera.streamUrl}
          isOnline={camera.status === 'online'}
          rotation={camera.rotation || 0}
        />
      );
    }
    if (camera.streamType === 'webrtc') {
      const streamId = camera.id.replace('cam-', '');
      // Use proxy path /whep/streamId
      const webrtcUrl = `/whep/${streamId}`;
      return (
        <WebrtcPlayer
          ref={webrtcRef}
          url={webrtcUrl}
          isOnline={camera.status === 'online'}
          rotation={camera.rotation || 0}
        />
      );
    }
    return (
      <MjpegPlayer
        ref={mjpegRef}
        url={camera.mjpegUrl}
        isOnline={camera.status === 'online'}
        rotation={camera.rotation || 0}
      />
    );
  };

  return (
    <div
      className={`group relative bg-card rounded-lg overflow-hidden border transition-all duration-300 cursor-pointer ${isSelected
        ? 'border-primary ring-2 ring-primary/30'
        : 'border-border hover:border-primary/50'
        }`}
      onClick={() => onSelect?.(camera)}
      onDoubleClick={() => onFullscreen?.(camera)}
    >
      {/* Video Container */}
      <div className="relative aspect-video overflow-hidden">
        {renderPlayer()}

        {/* Status Indicator */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[camera.status]}`} />
          <span className="text-xs font-medium text-white bg-background/50 px-1.5 py-0.5 rounded backdrop-blur-sm">
            {camera.name}
          </span>
        </div>

        {/* Human Detection Indicator */}
        {camera.humanDetectionEnabled && humanDetector.isDetecting && (
          <div className="absolute top-2 left-auto right-auto z-10" style={{ left: '50%', transform: 'translateX(-50%)' }}>
            {humanDetector.humanDetected ? (
              <Badge variant="destructive" className="gap-1 animate-pulse">
                <UserCheck className="w-3 h-3" />
                {humanDetector.detectionCount}人
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 opacity-70">
                <User className="w-3 h-3" />
                检测中
              </Badge>
            )}
          </div>
        )}

        {/* Recording Badge */}
        {camera.isRecording && (
          <div className="absolute top-2 right-12 z-10">
            <div onClick={handleRecordingClick}>
              <RecordingBadge
                isRecording={camera.isRecording}
                startTime={camera.recordingStartTime}
                onClick={() => onToggleRecording?.(camera.id)}
              />
            </div>
          </div>
        )}

        {/* Hover Actions */}
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full backdrop-blur-sm bg-background/60 hover:bg-background/80"
            onClick={handleFullscreen}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full backdrop-blur-sm bg-background/60 hover:bg-background/80"
            onClick={(e) => {
              e.stopPropagation();
              onEditDevice?.(camera);
            }}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info Bar */}
      <div className="p-2 border-t border-border/50">
        {/* Quick Action Buttons */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            {/* Screenshot Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleScreenshot}
              disabled={isCapturing || camera.status !== 'online'}
              title="截图"
            >
              <CameraIcon className="w-3.5 h-3.5" />
            </Button>

            {/* Recording Button */}
            <Button
              variant={camera.isRecording ? "destructive" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={handleRecordingClick}
              disabled={camera.status !== 'online'}
              title={camera.isRecording ? "停止录像" : "开始录像"}
            >
              {camera.isRecording ? (
                <Square className="w-3.5 h-3.5" />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
            </Button>

            {/* Rotation Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onRotate?.(camera);
              }}
              title={`旋转画面 (当前: ${camera.rotation || 0}°)`}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </Button>

            {/* Human Detection Toggle */}
            {camera.streamType !== 'mjpeg' && (
              <Button
                variant={humanDetector.isDetecting ? "default" : "ghost"}
                size="icon"
                className={`h-7 w-7 ${humanDetector.isDetecting ? 'bg-primary' : ''}`}
                onClick={handleToggleHumanDetection}
                disabled={camera.status !== 'online' || humanDetector.isModelLoading}
                title={humanDetector.isDetecting ? "关闭人形检测" : "开启人形检测"}
              >
                <User className="w-3.5 h-3.5" />
              </Button>
            )}

            {/* Audio/Volume Control */}
            <div onClick={(e) => e.stopPropagation()}>
              {camera.streamType === 'webrtc' ? (
                <VolumeControl
                  onVolumeChange={(vol) => webrtcRef.current?.setVolume(vol)}
                  onMuteToggle={(muted) => webrtcRef.current?.setMuted(muted)}
                  compact
                />
              ) : (
                <AudioPlayer
                  audioUrl={camera.audioUrl}
                  isEnabled={camera.hasAudio}
                  isOnline={camera.status === 'online'}
                  compact
                />
              )}
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-1.5">
            {camera.isRecording && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 animate-pulse">
                REC
              </Badge>
            )}
            {humanDetector.isDetecting && humanDetector.humanDetected && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 animate-pulse">
                {humanDetector.detectionCount}人
              </Badge>
            )}
          </div>
        </div>

        {/* Device Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{camera.deviceName}</span>
          <span className="font-mono text-muted-foreground/70">{camera.ipAddress}:{camera.port}</span>
        </div>
      </div>
    </div>
  );
}

