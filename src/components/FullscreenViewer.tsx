import { useState, useRef, useMemo, useEffect } from 'react';
import { Camera } from '@/types/camera';
import { MjpegPlayer, MjpegPlayerRef } from '@/components/MjpegPlayer';
import { HlsPlayer, HlsPlayerRef } from '@/components/HlsPlayer';
import { FlvPlayer, FlvPlayerRef } from '@/components/FlvPlayer';
import { WebrtcPlayer, WebrtcPlayerRef } from '@/components/WebrtcPlayer';
import { AudioPlayer } from '@/components/AudioPlayer';
import { RecordingControl } from '@/components/RecordingControl';
import { PTZControl } from '@/components/PTZControl';
import { ScreenshotControl, captureScreenshot } from '@/components/ScreenshotControl';
import { VideoRecorder } from '@/components/VideoRecorder';
import { MotionDetectorControl, MotionIndicator } from '@/components/MotionDetectorControl';
import { MotionEventLog, MotionEvent, loadEventsFromStorage, clearEventsFromStorage } from '@/components/MotionEventLog';
import { useMotionDetector } from '@/hooks/useMotionDetector';
import { VolumeControl } from '@/components/VolumeControl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Circle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Move,
  Camera as CameraIcon
} from 'lucide-react';

interface FullscreenViewerProps {
  camera: Camera;
  cameras: Camera[];
  onClose: () => void;
  onNavigate: (camera: Camera) => void;
  onToggleRecording?: (cameraId: string) => void;
}

export function FullscreenViewer({ camera, cameras, onClose, onNavigate, onToggleRecording }: FullscreenViewerProps) {
  const [showPTZ, setShowPTZ] = useState(false);
  const [motionEvents, setMotionEvents] = useState<MotionEvent[]>([]);
  const mjpegRef = useRef<MjpegPlayerRef>(null);
  const hlsRef = useRef<HlsPlayerRef>(null);
  const flvRef = useRef<FlvPlayerRef>(null);
  const webrtcRef = useRef<WebrtcPlayerRef>(null);

  // Load events from storage on mount
  useEffect(() => {
    setMotionEvents(loadEventsFromStorage());
  }, []);

  const handleMotionEvent = (event: MotionEvent) => {
    setMotionEvents(prev => [event, ...prev].slice(0, 100));
  };

  const handleClearEvents = () => {
    clearEventsFromStorage();
    setMotionEvents([]);
  };

  // Create a stable ref for motion detection
  const mediaRef = useMemo(() => ({
    get current() {
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

  const motionDetector = useMotionDetector(mediaRef, camera.name, camera.id, {
    onMotionEvent: handleMotionEvent,
  });

  const currentIndex = cameras.findIndex(c => c.id === camera.id);
  const prevCamera = cameras[currentIndex - 1];
  const nextCamera = cameras[currentIndex + 1];

  const handleCapture = async () => {
    const element = mediaRef.current;
    return captureScreenshot(element);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="h-12 md:h-14 px-2 md:px-4 flex items-center justify-between border-b border-border bg-card/50">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 md:h-9 md:w-9" onClick={onClose}>
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </Button>

          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0 ${camera.status === 'online' ? 'bg-success glow-success' :
              camera.status === 'connecting' ? 'bg-warning animate-pulse' : 'bg-destructive'
              }`} />
            <div className="min-w-0">
              <h2 className="font-semibold text-sm md:text-base truncate">{camera.name}</h2>
              <p className="text-[10px] md:text-xs text-muted-foreground font-mono truncate hidden sm:block">
                {camera.deviceName} • {camera.ipAddress}:{camera.port}
              </p>
            </div>
          </div>

          {camera.isRecording && (
            <Badge variant="destructive" className="gap-1 md:gap-1.5 text-[10px] md:text-xs shrink-0">
              <Circle className="w-1.5 h-1.5 md:w-2 md:h-2 fill-current animate-recording" />
              <span className="hidden md:inline">录制中</span>
              <span className="md:hidden">REC</span>
            </Badge>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {camera.resolution} • {camera.fps}fps
          </Badge>
          <Badge variant="secondary" className="font-mono">
            {camera.bitrate}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-2 md:p-4 relative">
        {/* Navigation Arrows - Hidden on small mobile */}
        {prevCamera && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-1 md:left-4 z-10 h-10 w-10 md:h-12 md:w-12 rounded-full bg-background/50 backdrop-blur-sm hidden sm:flex"
            onClick={() => onNavigate(prevCamera)}
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        )}

        {nextCamera && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 md:right-4 z-10 h-10 w-10 md:h-12 md:w-12 rounded-full bg-background/50 backdrop-blur-sm hidden sm:flex"
            onClick={() => onNavigate(nextCamera)}
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        )}

        {/* Video Player */}
        <div className="w-full max-w-6xl aspect-video rounded-lg overflow-hidden border border-border shadow-2xl relative">
          {camera.streamType === 'hls' && camera.hlsUrl ? (
            <HlsPlayer
              ref={hlsRef}
              url={camera.hlsUrl}
              isOnline={camera.status === 'online'}
            />
          ) : camera.streamType === 'flv' && camera.streamUrl ? (
            <FlvPlayer
              ref={flvRef}
              url={camera.streamUrl}
              isOnline={camera.status === 'online'}
            />
          ) : camera.streamType === 'webrtc' ? (
            <WebrtcPlayer
              ref={webrtcRef}
              url={`/whep/${camera.id.replace('cam-', '')}`}
              isOnline={camera.status === 'online'}
              isFullscreen={true}
            />
          ) : (
            <MjpegPlayer
              ref={mjpegRef}
              url={camera.mjpegUrl}
              isOnline={camera.status === 'online'}
            />
          )}

          {/* Motion Detection Indicator */}
          <MotionIndicator
            isDetecting={motionDetector.isDetecting}
            motionDetected={motionDetector.motionDetected}
          />

          {/* PTZ Overlay Control */}
          {showPTZ && camera.hasPTZ && (
            <div className="absolute bottom-4 right-4 z-10">
              <PTZControl
                baseUrl={camera.ptzUrl}
                isOnline={camera.status === 'online'}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="px-3 md:px-4 py-3 md:py-4 flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-6 border-t border-border bg-card/50">
        {/* Mobile Navigation */}
        <div className="flex items-center gap-2 sm:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={!prevCamera}
            onClick={() => prevCamera && onNavigate(prevCamera)}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            {currentIndex + 1}/{cameras.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={!nextCamera}
            onClick={() => nextCamera && onNavigate(nextCamera)}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-center">

          {/* Volume/Audio Control */}
          {camera.streamType === 'webrtc' && (
            <>
              <div className="hidden sm:block">
                <VolumeControl
                  onVolumeChange={(vol) => webrtcRef.current?.setVolume(vol)}
                  onMuteToggle={(muted) => webrtcRef.current?.setMuted(muted)}
                />
              </div>
              <div className="sm:hidden">
                <VolumeControl
                  onVolumeChange={(vol) => webrtcRef.current?.setVolume(vol)}
                  onMuteToggle={(muted) => webrtcRef.current?.setMuted(muted)}
                  compact
                />
              </div>
            </>
          )}

          {camera.streamType !== 'webrtc' && (
            <>
              <div className="hidden sm:block">
                <AudioPlayer
                  audioUrl={camera.audioUrl}
                  isEnabled={camera.hasAudio}
                  isOnline={camera.status === 'online'}
                />
              </div>
              <div className="sm:hidden">
                <AudioPlayer
                  audioUrl={camera.audioUrl}
                  isEnabled={camera.hasAudio}
                  isOnline={camera.status === 'online'}
                  compact
                />
              </div>
            </>
          )}

          <div className="hidden sm:block h-8 w-px bg-border" />

          {/* Screenshot Control */}
          <div className="hidden sm:block">
            <ScreenshotControl
              onCapture={handleCapture}
              cameraName={camera.name}
              isOnline={camera.status === 'online'}
            />
          </div>

          {/* Compact Screenshot for Mobile */}
          <div className="sm:hidden">
            <ScreenshotControl
              onCapture={handleCapture}
              cameraName={camera.name}
              isOnline={camera.status === 'online'}
              compact
            />
          </div>

          <div className="hidden sm:block h-8 w-px bg-border" />

          {/* Video Recorder */}
          <VideoRecorder
            camera={camera}
            mediaRef={mediaRef}
          />

          <div className="hidden sm:block h-8 w-px bg-border" />

          {/* Motion Detection Control */}
          <div className="hidden sm:block">
            <MotionDetectorControl
              isDetecting={motionDetector.isDetecting}
              motionDetected={motionDetector.motionDetected}
              motionLevel={motionDetector.motionLevel}
              onToggle={motionDetector.toggleDetection}
            />
          </div>

          {/* Compact Motion Detection for Mobile */}
          <div className="sm:hidden">
            <MotionDetectorControl
              isDetecting={motionDetector.isDetecting}
              motionDetected={motionDetector.motionDetected}
              motionLevel={motionDetector.motionLevel}
              onToggle={motionDetector.toggleDetection}
              compact
            />
          </div>

          <div className="hidden sm:block h-8 w-px bg-border" />

          {/* Motion Event Log */}
          <div className="hidden sm:block">
            <MotionEventLog
              events={motionEvents}
              onClearEvents={handleClearEvents}
            />
          </div>

          {/* Compact Event Log for Mobile */}
          <div className="sm:hidden">
            <MotionEventLog
              events={motionEvents}
              onClearEvents={handleClearEvents}
              compact
            />
          </div>

          {/* PTZ Toggle Button */}
          {camera.hasPTZ && (
            <Button
              variant={showPTZ ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9"
              onClick={() => setShowPTZ(!showPTZ)}
            >
              <Move className="w-5 h-5" />
            </Button>
          )}

          <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
            <Settings className="w-5 h-5" />
          </Button>

          <div className="hidden sm:block h-8 w-px bg-border" />

          <span className="hidden sm:block text-sm text-muted-foreground font-mono">
            {currentIndex + 1} / {cameras.length}
          </span>
        </div>
      </div>
    </div>
  );
}
