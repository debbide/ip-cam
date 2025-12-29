import { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { DeviceSidebar } from '@/components/DeviceSidebar';
import { CameraCard } from '@/components/CameraCard';
import { SystemStats } from '@/components/SystemStats';
import { FullscreenViewer } from '@/components/FullscreenViewer';
import { DeviceConfigDialog } from '@/components/DeviceConfigDialog';
import { LayoutSelector, LayoutType } from '@/components/LayoutSelector';
import { mockCameras as initialCameras } from '@/data/mockData';
import { useSystemStats } from '@/hooks/useSystemStats';
import { loadEventsFromStorage, clearEventsFromStorage, MotionEvent } from '@/components/MotionEventLog';
import { Camera } from '@/types/camera';
import { CameraFormValues } from '@/schemas/cameraSchema';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { saveConfigToStorage, loadConfigFromStorage, exportConfig, importConfig } from '@/utils/configManager';
import { ConfigManager } from '@/components/ConfigManager';
import { VideoPlayback } from '@/pages/VideoPlayback';
import { HumanDetectionProvider } from '@/contexts/HumanDetectionContext';

const Index = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // 加载保存的配置或使用初始数据
  const [cameras, setCameras] = useState<Camera[]>(() => {
    const saved = loadConfigFromStorage();
    if (saved) {
      // 自动迁移旧的 webrtcUrl 格式（直接访问 8889 端口 → 代理路径）
      return saved.map(cam => {
        if (cam.webrtcUrl && cam.webrtcUrl.includes(':8889/')) {
          // 从 http://host:8889/{streamId}/whep 或 http://host:8889/{streamId} 提取 streamId
          const match = cam.webrtcUrl.match(/:8889\/([^/]+)/);
          if (match) {
            const streamId = match[1];
            return { ...cam, webrtcUrl: `/whep/${streamId}` };
          }
        }
        return cam;
      });
    }
    return initialCameras;
  });

  const [selectedCamera, setSelectedCamera] = useState<Camera | undefined>();
  const [fullscreenCamera, setFullscreenCamera] = useState<Camera | undefined>();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | undefined>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [layout, setLayout] = useState<LayoutType>('auto');
  const [showPlayback, setShowPlayback] = useState(false);
  const [motionEvents, setMotionEvents] = useState<MotionEvent[]>(() => loadEventsFromStorage());

  // 定期刷新移动事件列表
  useEffect(() => {
    const interval = setInterval(() => {
      setMotionEvents(loadEventsFromStorage());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const alertCount = motionEvents.length;

  // 保存配置到本地存储
  useEffect(() => {
    saveConfigToStorage(cameras);
  }, [cameras]);

  // 应用启动时自动注册所有已保存的摄像头流到 MediaMTX
  useEffect(() => {
    const registerAllStreams = async () => {
      const registeredIds: string[] = [];

      for (const cam of cameras) {
        if (['hls', 'flv', 'webrtc'].includes(cam.streamType || '') && cam.streamUrl) {
          const streamId = cam.id.replace('cam-', '');
          console.log(`[Startup] Registering stream: ${streamId}`);
          const success = await addRtspStream(streamId, cam.streamUrl);
          if (success) {
            registeredIds.push(cam.id);
          }
        }
      }

      // 注册完成后，触发摄像头状态更新以刷新播放器
      if (registeredIds.length > 0) {
        console.log(`[Startup] All streams registered, refreshing ${registeredIds.length} cameras`);
        setCameras(prev => prev.map(cam => {
          if (registeredIds.includes(cam.id)) {
            return { ...cam, status: 'online' as const, lastSeen: new Date() };
          }
          return cam;
        }));
      }
    };

    // 延迟一点执行，等待 MediaMTX 启动完成
    const timer = setTimeout(() => {
      registerAllStreams();
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  const handleAddDevice = () => {
    setEditingCamera(undefined);
    setConfigDialogOpen(true);
    setMobileMenuOpen(false);
  };

  const handleEditDevice = (camera: Camera) => {
    setEditingCamera(camera);
    setConfigDialogOpen(true);
  };

  const handleToggleRecording = useCallback((cameraId: string) => {
    setCameras(prev => prev.map(cam => {
      if (cam.id === cameraId) {
        const isStarting = !cam.isRecording;

        if (isStarting) {
          // toast({
          //   title: '开始录制',
          //   description: `${cam.name} 录制已开始`,
          // });
          return {
            ...cam,
            isRecording: true,
            recordingStartTime: new Date(),
          };
        } else {
          // const duration = cam.recordingStartTime
          //   ? Math.floor((Date.now() - cam.recordingStartTime.getTime()) / 1000)
          //   : 0;
          // const mins = Math.floor(duration / 60);
          // const secs = duration % 60;

          // toast({
          //   title: '录制已停止',
          //   description: `${cam.name} 录制时长：${mins}分${secs}秒`,
          // });
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

  // 自动添加 RTSP 流到转码服务
  const addRtspStream = async (streamId: string, rtspUrl: string) => {
    try {
      // 先尝试删除已存在的流
      await fetch(`/api/streams/${streamId}`, { method: 'DELETE' }).catch(() => { });

      // 添加新流
      const response = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: streamId, rtspUrl }),
      });

      if (response.ok) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to add RTSP stream:', error);
      return false;
    }
  };

  const handleSaveDevice = async (data: CameraFormValues) => {
    // 构建带认证的 URL
    const authPart = data.username ? `${data.username}${data.password ? ':' + data.password : ''}@` : '';
    const rtspUrl = data.rtspPath
      ? `rtsp://${authPart}${data.ipAddress}:${data.port}${data.rtspPath}`
      : '';

    if (editingCamera) {
      const streamId = editingCamera.id.replace('cam-', '');
      const hlsUrl = `/hls/${streamId}/stream.m3u8`;

      // 如果是 HLS/FLV/WebRTC 流类型，自动添加 RTSP 流
      if (['hls', 'flv', 'webrtc'].includes(data.streamType) && rtspUrl) {
        const success = await addRtspStream(streamId, rtspUrl);
        if (!success) {
          toast({
            title: '转码服务添加失败',
            description: '请确保转码服务正在运行',
            variant: 'destructive',
          });
        }
      }

      setCameras(prev => prev.map(cam => {
        if (cam.id === editingCamera.id) {
          return {
            ...cam,
            name: data.name,
            deviceName: data.deviceName,
            ipAddress: data.ipAddress,
            port: data.port,
            username: data.username,
            password: data.password,
            mjpegPath: data.mjpegPath,
            rtspPath: data.rtspPath,
            hasAudio: data.hasAudio,
            resolution: data.resolution,
            fps: data.fps,
            status: 'online',
            mjpegUrl: `http://${authPart}${data.ipAddress}:${data.port}${data.mjpegPath}`,
            audioUrl: data.hasAudio ? `http://${authPart}${data.ipAddress}:${data.port}/audio.wav` : '',
            streamUrl: rtspUrl || cam.streamUrl,
            ptzUrl: `http://${authPart}${data.ipAddress}:${data.port}`,
            streamType: data.streamType || 'mjpeg',
            hlsUrl: data.streamType === 'hls' ? hlsUrl : undefined,
            webrtcUrl: data.streamType === 'webrtc' ? `/whep/${streamId}` : undefined,
            humanDetectionEnabled: data.humanDetectionEnabled,
          };
        }
        return cam;
      }));

      toast({
        title: '设备已更新',
        description: `${data.name} 的配置已保存`,
      });
    } else {
      const camId = `cam-${Date.now()}`;
      const streamId = camId.replace('cam-', '');
      const hlsUrl = `/hls/${streamId}/stream.m3u8`;

      // 如果是 HLS/FLV/WebRTC 流类型，自动添加 RTSP 流
      if (['hls', 'flv', 'webrtc'].includes(data.streamType) && rtspUrl) {
        const success = await addRtspStream(streamId, rtspUrl);
        if (!success) {
          toast({
            title: '转码服务添加失败',
            description: '请确保转码服务正在运行',
            variant: 'destructive',
          });
        }
      }

      const newCamera: Camera = {
        id: camId,
        name: data.name,
        deviceName: data.deviceName,
        ipAddress: data.ipAddress,
        port: data.port,
        username: data.username,
        password: data.password,
        mjpegPath: data.mjpegPath,
        rtspPath: data.rtspPath,
        status: 'online',
        isRecording: false,
        hasAudio: data.hasAudio,
        hasPTZ: true,
        resolution: data.resolution,
        fps: data.fps,
        bitrate: '0 Mbps',
        lastSeen: new Date(),
        mjpegUrl: `http://${authPart}${data.ipAddress}:${data.port}${data.mjpegPath}`,
        audioUrl: data.hasAudio ? `http://${authPart}${data.ipAddress}:${data.port}/audio.wav` : '',
        streamUrl: rtspUrl,
        ptzUrl: `http://${authPart}${data.ipAddress}:${data.port}`,
        streamType: data.streamType || 'mjpeg',
        hlsUrl: data.streamType === 'hls' ? hlsUrl : undefined,
        webrtcUrl: data.streamType === 'webrtc' ? `/whep/${streamId}` : undefined,
        humanDetectionEnabled: data.humanDetectionEnabled,
      };

      setCameras(prev => [...prev, newCamera]);

      toast({
        title: '设备已添加',
        description: `${data.name} 已添加到设备列表`,
      });
    }
  };

  const handleDeleteDevice = (cameraId: string) => {
    const camera = cameras.find(c => c.id === cameraId);
    setCameras(prev => prev.filter(cam => cam.id !== cameraId));

    if (selectedCamera?.id === cameraId) {
      setSelectedCamera(undefined);
    }

    toast({
      title: '设备已删除',
      description: camera ? `${camera.name} 已从列表中移除` : '设备已删除',
      variant: 'destructive',
    });
  };

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

  const handleImportConfig = (importedCameras: Camera[]) => {
    setCameras(importedCameras);
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
              configManager={<ConfigManager />}
              onPlaybackClick={() => setShowPlayback(true)}
            />

            <div className="flex-1 flex overflow-hidden">
              {/* Desktop Sidebar */}
              <div className="hidden md:block">
                <DeviceSidebar
                  cameras={cameras}
                  selectedCamera={selectedCamera}
                  onSelectCamera={setSelectedCamera}
                  onAddDevice={handleAddDevice}
                  onEditDevice={handleEditDevice}
                  onDeleteDevice={handleDeleteDevice}
                />
              </div>

              {/* Mobile Sidebar Sheet */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetContent side="left" className="w-80 p-0">
                  <DeviceSidebar
                    cameras={cameras}
                    selectedCamera={selectedCamera}
                    onSelectCamera={setSelectedCamera}
                    onAddDevice={handleAddDevice}
                    onEditDevice={handleEditDevice}
                    onDeleteDevice={handleDeleteDevice}
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

                {/* Camera Grid & Event Log */}
                <div className="flex-1 flex overflow-hidden relative">
                  {/* Camera Grid */}
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
                            onEditDevice={handleEditDevice}
                            onRotate={handleRotateCamera}
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
                        <p className="text-sm mb-4 text-center">添加您的第一个 IP Webcam 设备</p>
                        <button
                          onClick={handleAddDevice}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          添加设备
                        </button>
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
              />
            )}

            {/* Device Config Dialog */}
            <DeviceConfigDialog
              open={configDialogOpen}
              onOpenChange={setConfigDialogOpen}
              camera={editingCamera}
              onSave={handleSaveDevice}
              onDelete={handleDeleteDevice}
            />
          </div>
        </HumanDetectionProvider>
      )}
    </>
  );
};

export default Index;

