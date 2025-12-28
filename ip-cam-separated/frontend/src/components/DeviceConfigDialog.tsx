import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, DetectionRegion } from '@/types/camera';
import { cameraFormSchema, CameraFormValues } from '@/schemas/cameraSchema';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Smartphone, Link, Settings2, Loader2, ScanLine } from 'lucide-react';
import { DetectionRegionSelector } from '@/components/DetectionRegionSelector';

interface DeviceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camera?: Camera;
  onSave: (data: CameraFormValues) => void;
  onDelete?: (cameraId: string) => void;
}

export function DeviceConfigDialog({
  open,
  onOpenChange,
  camera,
  onSave,
  onDelete,
}: DeviceConfigDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const isEditing = !!camera;

  const form = useForm<CameraFormValues>({
    resolver: zodResolver(cameraFormSchema),
    defaultValues: camera
      ? {
        name: camera.name,
        deviceName: camera.deviceName,
        ipAddress: camera.ipAddress,
        port: camera.port,
        username: camera.username || '',
        password: camera.password || '',
        mjpegPath: camera.mjpegPath || '/video',
        rtspPath: camera.rtspPath || '/live',
        hasAudio: camera.hasAudio,
        resolution: camera.resolution,
        fps: camera.fps,
        streamType: camera.streamType || 'mjpeg',
        hlsUrl: camera.hlsUrl || '/hls/cam1/stream.m3u8',
        humanDetectionEnabled: camera.humanDetectionEnabled || false,
        humanDetectionRegion: camera.humanDetectionRegion,
      }
      : {
        name: '',
        deviceName: '',
        ipAddress: '',
        port: 8080,
        username: '',
        password: '',
        mjpegPath: '/video',
        rtspPath: '/live',
        hasAudio: true,
        resolution: '1920x1080',
        fps: 30,
        streamType: 'mjpeg',
        hlsUrl: '/hls/cam1/stream.m3u8',
        humanDetectionEnabled: false,
      },
  });

  const watchIp = form.watch('ipAddress');
  const watchPort = form.watch('port');
  const watchUsername = form.watch('username');
  const watchPassword = form.watch('password');
  const watchMjpegPath = form.watch('mjpegPath');
  const watchRtspPath = form.watch('rtspPath');
  const watchHumanDetectionEnabled = form.watch('humanDetectionEnabled');
  const watchHumanDetectionRegion = form.watch('humanDetectionRegion');

  // 构建带认证的 URL
  const authPart = watchUsername ? `${watchUsername}${watchPassword ? ':' + watchPassword : ''}@` : '';
  const previewMjpegUrl = watchIp && watchPort ? `http://${authPart}${watchIp}:${watchPort}${watchMjpegPath}` : '';
  const previewRtspUrl = watchIp && watchPort && watchRtspPath ? `rtsp://${authPart}${watchIp}:${watchPort}${watchRtspPath}` : '';

  // 当对话框打开或 camera 变化时重置表单
  useEffect(() => {
    if (open) {
      if (camera) {
        form.reset({
          name: camera.name,
          deviceName: camera.deviceName,
          ipAddress: camera.ipAddress,
          port: camera.port,
          username: camera.username || '',
          password: camera.password || '',
          mjpegPath: camera.mjpegPath || '/video',
          rtspPath: camera.rtspPath || '/live',
          hasAudio: camera.hasAudio,
          resolution: camera.resolution,
          fps: camera.fps,
          streamType: camera.streamType || 'mjpeg',
          hlsUrl: camera.hlsUrl || '/hls/cam1/stream.m3u8',
          humanDetectionEnabled: camera.humanDetectionEnabled || false,
          humanDetectionRegion: camera.humanDetectionRegion,
        });
      } else {
        form.reset({
          name: '',
          deviceName: '',
          ipAddress: '',
          port: 8080,
          username: '',
          password: '',
          mjpegPath: '/video',
          rtspPath: '/live',
          hasAudio: true,
          resolution: '1920x1080',
          fps: 30,
          streamType: 'mjpeg',
          hlsUrl: '/hls/cam1/stream.m3u8',
          humanDetectionEnabled: false,
        });
      }
    }
  }, [open, camera, form]);

  const handleSubmit = async (data: CameraFormValues) => {
    setIsSubmitting(true);
    try {
      await onSave(data);
      onOpenChange(false);
      form.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (camera && onDelete) {
      onDelete(camera.id);
      onOpenChange(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
    setShowDeleteConfirm(false);
    setShowRegionSelector(false);
  };

  const handleRegionSave = (region: DetectionRegion | undefined) => {
    form.setValue('humanDetectionRegion', region, { shouldDirty: true });
    setShowRegionSelector(false);
  };

  if (showRegionSelector && camera) {
    return (
      <Dialog open={true} onOpenChange={setShowRegionSelector}>
        <DialogContent className="max-w-4xl h-[80vh] bg-card border-border flex flex-col">
          <DetectionRegionSelector
            camera={{
              ...camera,
              // 使用当前表单中的流配置，以便预览
              streamType: form.getValues('streamType'),
              mjpegUrl: previewMjpegUrl, // 这是一个近似值，实际可能需要更复杂的逻辑来构建完整 URL
              // 注意：这里我们假设 camera 对象已经包含了正确的 URL，或者我们使用表单值构建
              // 为了简单起见，如果是在编辑模式，我们尽量使用原始 camera 对象，
              // 但如果用户更改了流设置，预览可能不准确。
              // 理想情况下，我们应该根据表单值构建一个临时的 camera 对象用于预览。
            }}
            initialRegion={watchHumanDetectionRegion as DetectionRegion | undefined}
            onSave={handleRegionSave}
            onCancel={() => setShowRegionSelector(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            {isEditing ? '编辑设备' : '添加新设备'}
          </DialogTitle>
          <DialogDescription>
            配置 IP Webcam 设备的连接参数
          </DialogDescription>
        </DialogHeader>

        {showDeleteConfirm ? (
          <div className="py-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">确认删除设备？</h3>
              <p className="text-muted-foreground text-sm">
                确定要删除 "{camera?.name}" 吗？此操作无法撤销。
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                取消
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                确认删除
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic" className="gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    基本信息
                  </TabsTrigger>
                  <TabsTrigger value="stream" className="gap-1.5">
                    <Link className="w-4 h-4" />
                    流地址
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="gap-1.5">
                    <Settings2 className="w-4 h-4" />
                    高级设置
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>设备名称</FormLabel>
                        <FormControl>
                          <Input placeholder="例如：前门监控" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deviceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>手机型号</FormLabel>
                        <FormControl>
                          <Input placeholder="例如：Galaxy S21" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="ipAddress"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>IP 地址</FormLabel>
                          <FormControl>
                            <Input placeholder="192.168.1.100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>端口</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="8080" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>用户名（可选）</FormLabel>
                          <FormControl>
                            <Input placeholder="admin" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>密码（可选）</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="stream" className="space-y-4 mt-4">
                  {/* 流类型选择 */}
                  <FormField
                    control={form.control}
                    name="streamType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>流类型</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择流类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="mjpeg">MJPEG（直接播放）</SelectItem>
                            <SelectItem value="hls">RTSP → HLS（兼容性好）</SelectItem>
                            <SelectItem value="flv">RTSP → FLV（低延迟）</SelectItem>
                            <SelectItem value="webrtc">RTSP → WebRTC（超低延迟）</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {form.watch('streamType') === 'hls'
                            ? '使用 RTSP 流通过转码服务播放 (延迟 3-5s)'
                            : form.watch('streamType') === 'flv'
                              ? '使用 HTTP-FLV 协议播放 (延迟 <1s)'
                              : form.watch('streamType') === 'webrtc'
                                ? '使用 WebRTC 协议播放 (延迟 <500ms)'
                                : '直接在浏览器播放 MJPEG 流'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* MJPEG 配置 */}
                  {form.watch('streamType') === 'mjpeg' && (
                    <FormField
                      control={form.control}
                      name="mjpegPath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MJPEG 视频路径</FormLabel>
                          <FormControl>
                            <Input placeholder="/video" {...field} />
                          </FormControl>
                          <FormDescription className="font-mono text-xs break-all">
                            {previewMjpegUrl || 'http://IP:PORT/video'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* RTSP 配置 - 对 HLS/FLV/WebRTC 模式都显示 */}
                  {(form.watch('streamType') === 'hls' || form.watch('streamType') === 'flv' || form.watch('streamType') === 'webrtc') && (
                    <>
                      <FormField
                        control={form.control}
                        name="rtspPath"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>RTSP 流路径</FormLabel>
                            <FormControl>
                              <Input placeholder="/live" {...field} />
                            </FormControl>
                            <FormDescription className="font-mono text-xs break-all">
                              {previewRtspUrl || 'rtsp://IP:PORT/live'}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* 常用 RTSP 路径快捷选择 */}
                      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-xs text-muted-foreground mb-2">常用 RTSP 路径（点击填充）：</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: 'IP Webcam', path: '/h264_pcm.sdp' },
                            { label: '海康威视', path: '/Streaming/Channels/101' },
                            { label: '大华', path: '/cam/realmonitor?channel=1&subtype=0' },
                            { label: '宇视', path: '/video1' },
                            { label: 'TP-Link', path: '/stream1' },
                            { label: '萤石', path: '/h264/ch1/main/av_stream' },
                            { label: '通用', path: '/live' },
                          ].map((preset) => (
                            <button
                              key={preset.path}
                              type="button"
                              className="px-2 py-1 text-xs rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                              onClick={() => form.setValue('rtspPath', preset.path)}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                        <p className="text-sm font-medium text-primary">自动转码</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          保存后将自动添加 RTSP 流到 MediaMTX 转码服务
                        </p>
                      </div>
                    </>
                  )}

                  {/* MJPEG 路径提示 */}
                  {form.watch('streamType') === 'mjpeg' && (
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-2">常用 MJPEG 路径（点击填充）：</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: 'IP Webcam', path: '/video' },
                          { label: '海康威视', path: '/ISAPI/Streaming/channels/101/httpPreview' },
                          { label: '通用', path: '/mjpeg' },
                          { label: '带参数', path: '/video?type=some.mjpeg' },
                        ].map((preset) => (
                          <button
                            key={preset.path}
                            type="button"
                            className="px-2 py-1 text-xs rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                            onClick={() => form.setValue('mjpegPath', preset.path)}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="resolution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>分辨率</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择分辨率" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="640x480">640×480 (VGA)</SelectItem>
                            <SelectItem value="1280x720">1280×720 (720p)</SelectItem>
                            <SelectItem value="1920x1080">1920×1080 (1080p)</SelectItem>
                            <SelectItem value="2560x1440">2560×1440 (2K)</SelectItem>
                            <SelectItem value="3840x2160">3840×2160 (4K)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>帧率 (FPS)</FormLabel>
                        <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择帧率" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="15">15 FPS</SelectItem>
                            <SelectItem value="20">20 FPS</SelectItem>
                            <SelectItem value="25">25 FPS</SelectItem>
                            <SelectItem value="30">30 FPS</SelectItem>
                            <SelectItem value="60">60 FPS</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hasAudio"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>启用音频</FormLabel>
                          <FormDescription>
                            开启后将使用支持音频的 RTSP 流
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="rounded-lg border border-border p-3 space-y-3">
                    <FormField
                      control={form.control}
                      name="humanDetectionEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel>启用人形检测</FormLabel>
                            <FormDescription>
                              开启后在主页面持续检测人形并发送告警
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {watchHumanDetectionEnabled && (
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium">检测区域</span>
                          <p className="text-xs text-muted-foreground">
                            {watchHumanDetectionRegion
                              ? '已设置自定义区域'
                              : '全屏检测 (默认)'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRegionSelector(true)}
                          disabled={!isEditing} // 只有在编辑模式下才能设置区域（因为需要摄像头信息）
                        >
                          <ScanLine className="w-4 h-4 mr-2" />
                          设置区域
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="gap-2 sm:gap-0">
                {isEditing && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="mr-auto"
                  >
                    删除设备
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={handleClose}>
                  取消
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isEditing ? '保存更改' : '添加设备'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
