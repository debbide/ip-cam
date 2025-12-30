import { useState, useCallback, useEffect } from 'react';
import { nativeFetch } from '@/utils/nativeHttp';
import { Header } from '@/components/Header';
import { DeviceSidebar } from '@/components/DeviceSidebar';
import { CameraCard } from '@/components/CameraCard';
import { SystemStats } from '@/components/SystemStats';
import { FullscreenViewer } from '@/components/FullscreenViewer';
import { LayoutSelector, LayoutType } from '@/components/LayoutSelector';
import { useSystemStats } from '@/hooks/useSystemStats';
import { loadEventsFromStorage, clearEventsFromStorage, MotionEvent } from '@/components/MotionEventLog';
import { Camera } from '@/types/camera';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { VideoPlayback } from '@/pages/VideoPlayback';
import { HumanDetectionProvider } from '@/contexts/HumanDetectionContext';
import { useServer } from '@/contexts/ServerContext';

const Index = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { getApiUrl, getHlsUrl, getWebrtcUrl, isConnected, getAuthHeaders } = useServer();

  // 摄像头列表（从后端获取）
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isLoadingCameras, setIsLoadingCameras] = useState(false);

  const [selectedCamera, setSelectedCamera] = useState<Camera | undefined>();
  const [fullscreenCamera, setFullscreenCamera] = useState<Camera | undefined>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [layout, setLayout] = useState<LayoutType>('auto');
  const [showPlayback, setShowPlayback] = useState(false);
  const [motionEvents, setMotionEvents] = useState<MotionEvent[]>(() => loadEventsFromStorage());
  const [streamPassword, setStreamPassword] = useState<string>('');

  // 获取流密码
  useEffect(() => {
    const fetchSettings = async () => {
      if (!isConnected) return;
      try {
        const res = await nativeFetch(getApiUrl('/api/settings'), {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.streamAuth && data.streamAuth.enabled) {
            setStreamPassword(data.streamAuth.password || '');
          } else {
            setStreamPassword('');
          }
        }
      } catch (e) {
        console.error('Failed to fetch settings:', e);
      }
    };
    fetchSettings();
  }, [isConnected, getApiUrl, getAuthHeaders]);

  // 定期刷新移动事件列表
  useEffect(() => {
    const interval = setInterval(() => {
      setMotionEvents(loadEventsFromStorage());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const alertCount = motionEvents.length;

  // 从后端获取摄像头列表
  const fetchCamerasFromBackend = useCallback(async () => {
    if (!isConnected) return;

    setIsLoadingCameras(true);
    try {
      const response = await fetch(getApiUrl('/api/streams'), {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const streams = await response.json();
        console.log('[Backend] Fetched cameras:', streams);

        // 将后端数据转换为前端 Camera 类型
        const backendCameras: Camera[] = streams.map((s: any) => {
          // 从 rtspUrl 解析 IP、端口等信息
          let ipAddress = '';
          let port = 554;
          let username = '';
          let password = '';
          let rtspPath = '/live';

          if (s.rtspUrl) {
            try {
              const url = new URL(s.rtspUrl);
              ipAddress = url.hostname;
              port = parseInt(url.port) || 554;
              username = url.username || '';
              password = url.password || '';
              rtspPath = url.pathname + url.search;
            } catch (e) {
              console.warn('Failed to parse rtspUrl:', s.rtspUrl);
            }
          }

          return {
            id: s.id,
            name: s.name || s.id,
            deviceName: '',
            ipAddress,
            port,
            username,
            password,
            mjpegPath: '/video',
            rtspPath,
            status: s.status === 'running' ? 'online' : 'offline',
            isRecording: false,
            hasAudio: true,
            hasPTZ: false,
            resolution: '1920x1080',
            fps: 30,
            bitrate: '0 Mbps',
            lastSeen: new Date(s.startTime || Date.now()),
            streamUrl: s.rtspUrl || '',
            mjpegUrl: '',
            hlsUrl: getHlsUrl(s.id),
            webrtcUrl: getWebrtcUrl(s.id),
            audioUrl: '',
            ptzUrl: '',
            streamType: 'webrtc' as const,
            humanDetectionEnabled: false,
          } as Camera;
        });

        setCameras(backendCameras);
      } else {
        console.error('[Backend] Failed to fetch cameras:', response.status);
      }
    } catch (error) {
      console.error('[Backend] Error fetching cameras:', error);
    } finally {
      setIsLoadingCameras(false);
    }
  }, [isConnected, getApiUrl, getAuthHeaders, getHlsUrl, getWebrtcUrl]);

  // 连接成功后自动获取摄像头列表
  useEffect(() => {
    if (isConnected) {
      fetchCamerasFromBackend();
    }
  }, [isConnected, fetchCamerasFromBackend]);

  const handleToggleRecording = useCallback((cameraId: string) => {
    setCameras(prev => prev.map(cam => {
      if (cam.id === cameraId) {
        const isStarting = !cam.isRecording;

        if (isStarting) {
          toast({
            title: '开始录制',
            description: `${cam.name} 录制已开始`,
          });
          return {
            ...cam,
            isRecording: true,
            recordingStartTime: new Date(),
          };
        } else {
          const duration = cam.recordingStartTime
            ? Math.floor((Date.now() - cam.recordingStartTime.getTime()) / 1000)
            : 0;
          const mins = Math.floor(duration / 60);
          const secs = duration % 60;

          toast({
            title: '录制已停止',
            description: `${cam.name} 录制时长：${mins}分${secs}秒`,
          });
          return {
            ...cam,
            isRecording: false,
            recordingStartTime: undefined,
          };
        }
      }
      return cam;
    }));

    // Update fullscreen camera if it matches
    setFullscreenCamera(prev => {
      if (prev?.id === cameraId) {
        const cam = cameras.find(c => c.id === cameraId);
        if (cam) {
          const isStarting = !cam.isRecording;
          return {
            ...cam,
            isRecording: isStarting,
            recordingStartTime: isStarting ? new Date() : undefined,
          };
        }
      }
      return prev;
    });
  }, [cameras, toast]);

  const handleRotateCamera = (camera: Camera) => {
    const currentRotation = camera.rotation || 0;
    const nextRotation = (currentRotation + 90) % 360 as 0 | 90 | 180 | 270;

    setCameras(prev => prev.map(cam => {
      if (cam.id === camera.id) {
        return { ...cam, rotation: nextRotation };
      }
      return cam;
    }));

    toast({
      title: '画面已旋转',
      description: `当前角度: ${nextRotation}°`,
      duration: 1000,
    });
  };

  // Keep fullscreen camera in sync with cameras state
  const syncedFullscreenCamera = fullscreenCamera
    ? cameras.find(c => c.id === fullscreenCamera.id)
    : undefined;

  // 获取真实的系统状态
  const { stats: realStats } = useSystemStats(5000);

  const systemStats = {
    totalCameras: cameras.length,
    onlineCameras: cameras.filter(c => c.status === 'online').length,
    recordingCameras: cameras.filter(c => c.isRecording).length,
    totalStorage: realStats ? `${realStats.disk.total} GB` : '-- GB',
    usedStorage: realStats ? `${realStats.disk.used} GB` : '-- GB',
    cpuUsage: realStats?.cpu ?? 0,
    memoryUsage: realStats?.memory.usedPercent ?? 0,
  };

  return (
    <>
      {/* Video Playback Page */}
      {showPlayback && (
        <VideoPlayback onBack={() => setShowPlayback(false)} />
      )}

      {/* Main Page */}
      {!showPlayback && (
        <HumanDetectionProvider cameras={cameras}>
          <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header
              alertCount={alertCount}
              motionEvents={motionEvents}
              onClearEvents={() => {
                clearEventsFromStorage();
                setMotionEvents([]);
              }}
              onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              isMobileMenuOpen={mobileMenuOpen}
              onPlaybackClick={() => setShowPlayback(true)}
            />

            <div className="flex-1 flex overflow-hidden">
              {/* Desktop Sidebar */}
              <div className="hidden md:block">
                <DeviceSidebar
                  cameras={cameras}
                  selectedCamera={selectedCamera}
                  onSelectCamera={setSelectedCamera}
                />
              </div>

              {/* Mobile Sidebar Sheet */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetContent side="left" className="w-80 p-0">
                  <DeviceSidebar
                    cameras={cameras}
                    selectedCamera={selectedCamera}
                    onSelectCamera={setSelectedCamera}
                    isMobile
                    onClose={() => setMobileMenuOpen(false)}
                  />
                </SheetContent>
              </Sheet>

              {/* Main Content */}
              <main className="flex-1 flex flex-col overflow-hidden">
                {/* System Stats Bar with Layout Selector */}
                <div className="p-2 md:p-4 border-b border-border flex items-center justify-between gap-4">
                  <SystemStats stats={systemStats} />
                  <div className="hidden md:block">
                    <LayoutSelector layout={layout} onLayoutChange={setLayout} />
                  </div>
                </div>

                {/* Camera Grid */}
                <div className="flex-1 flex overflow-hidden relative">
                  <div className="flex-1 p-2 md:p-4 overflow-auto pb-20 md:pb-4">
                    {cameras.length > 0 ? (
                      <div className={`camera-grid ${layout === 'auto' ? '' : `camera-grid-${layout}`}`}>
                        {cameras.map((camera) => (
                          <CameraCard
                            key={camera.id}
                            camera={camera}
                            isSelected={selectedCamera?.id === camera.id}
                            onSelect={setSelectedCamera}
                            onFullscreen={setFullscreenCamera}
                            onToggleRecording={handleToggleRecording}
                            onRotate={handleRotateCamera}
                            streamPassword={streamPassword}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground px-4">
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-base md:text-lg font-medium mb-2">暂无摄像头</p>
                        <p className="text-sm text-center">请在后端管理界面添加摄像头</p>
                      </div>
                    )}
                  </div>
                </div>
              </main>
            </div>

            {/* Fullscreen Viewer */}
            {syncedFullscreenCamera && (
              <FullscreenViewer
                camera={syncedFullscreenCamera}
                cameras={cameras}
                onClose={() => setFullscreenCamera(undefined)}
                onNavigate={setFullscreenCamera}
                onToggleRecording={handleToggleRecording}
                streamPassword={streamPassword}
              />
            )}
          </div>
        </HumanDetectionProvider>
      )}
    </>
  );
};

export default Index;
