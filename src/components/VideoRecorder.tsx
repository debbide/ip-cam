import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera } from '@/types/camera';
import { toast } from 'sonner';
import { Video, Square, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Circle } from 'lucide-react';

interface VideoRecorderProps {
  camera: Camera;
  mediaRef: React.RefObject<HTMLImageElement | HTMLVideoElement | null>;
  directStream?: MediaStream | null; // 用于 WebRTC 直接录制
}

export function VideoRecorder({ camera, mediaRef, directStream }: VideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const hasLoggedErrorRef = useRef(false);

  useEffect(() => {
    if (!isRecording) {
      setElapsed(0);
      hasLoggedErrorRef.current = false; // 重置错误标记
      return;
    }


    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    setIsPreparing(true);

    try {
      let recordStream: MediaStream | null = null;
      let usingDirectStream = false;

      // 优先使用直接的 MediaStream (WebRTC)
      if (directStream && directStream.getTracks().length > 0) {
        console.log('[Recording] Using direct MediaStream from WebRTC');
        recordStream = directStream;
        usingDirectStream = true;
        streamRef.current = directStream;
      } else {
        // 回退到 canvas 捕获方式
        const element = mediaRef.current;
        if (!element) {
          toast.error('无法获取视频源');
          setIsPreparing(false);
          return;
        }

        // 获取尺寸
        let width = 0;
        let height = 0;

        if (element instanceof HTMLImageElement) {
          width = element.naturalWidth;
          height = element.naturalHeight;
        } else if (element instanceof HTMLVideoElement) {
          width = element.videoWidth;
          height = element.videoHeight;

          // 检查视频是否已准备就绪
          if (element.readyState < 2) { // HAVE_CURRENT_DATA
            console.warn('[Recording] Video not ready, readyState:', element.readyState);
            toast.error('视频还未准备好，请稍后再试');
            setIsPreparing(false);
            return;
          }
        }

        // 检查尺寸是否有效
        if (width === 0 || height === 0) {
          console.error('[Recording] Invalid dimensions:', { width, height, element });
          toast.error('无法获取视频尺寸，请确保视频已连接');
          setIsPreparing(false);
          return;
        }

        console.log('[Recording] Using canvas capture with dimensions:', { width, height });

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvasRef.current = canvas;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('无法创建画布上下文');
        }

        recordStream = canvas.captureStream(15);
        streamRef.current = recordStream;

        // 启动绘制循环
        let isActive = true;
        const drawFrame = () => {
          if (canvasRef.current && mediaRef.current && ctx && isActive) {
            try {
              ctx.drawImage(mediaRef.current, 0, 0, canvas.width, canvas.height);

              // 绘制时间戳水印
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

              ctx.font = 'bold 20px monospace';
              ctx.fillStyle = 'white';
              ctx.strokeStyle = 'black';
              ctx.lineWidth = 3;
              ctx.shadowColor = 'black';
              ctx.shadowBlur = 2;

              const x = 20;
              const y = 40;

              ctx.strokeText(timeString, x, y);
              ctx.fillText(timeString, x, y);
            } catch (e: any) {
              // Ignore CORS errors, but log once
              if (!hasLoggedErrorRef.current) {
                console.error('[Recording] Draw error:', e, '\nElement:', mediaRef.current);
                toast.error(`录制画面捕获失败: ${e.message || '未知错误'}`);
                hasLoggedErrorRef.current = true;
              }
            }
            animationFrameRef.current = requestAnimationFrame(drawFrame);
          }
        };
        drawFrame();
      }

      if (!recordStream) {
        throw new Error('无法创建录制流');
      }


      const mimeType = 'video/webm';

      const mediaRecorder = new MediaRecorder(recordStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log(`Recording stopped. Blob size: ${blob.size} bytes`);

        if (blob.size === 0) {
          toast.error('录制失败：文件大小为 0');
          return;
        }

        const filename = `${camera.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;

        // 尝试使用 Electron API 保存到录像文件夹
        if (window.electronAPI) {
          try {
            const reader = new FileReader();
            reader.onload = async () => {
              const dataUrl = reader.result as string;
              const result = await window.electronAPI.saveFile(dataUrl, filename, '录像');
              if (result.success) {
                toast.success(`录像已保存 (${(blob.size / 1024).toFixed(1)} KB)`, { description: result.path });
              } else {
                toast.error('录像保存失败');
              }
            };
            reader.readAsDataURL(blob);
          } catch (error) {
            // 回退到普通下载
            downloadBlob(blob, filename);
          }
        } else {
          downloadBlob(blob, filename);
        }
      };


      function downloadBlob(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('录像已保存');
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.start(1000);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPreparing(false);

      toast.success('开始录制');

    } catch (error) {
      console.error('录制启动失败:', error);
      toast.error('录制启动失败');
      setIsPreparing(false);
    }
  }, [mediaRef, camera.name]);

  const stopRecording = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isRecording ? 'destructive' : 'secondary'}
        size="sm"
        onClick={toggleRecording}
        disabled={isPreparing}
        className="gap-2"
      >
        {isPreparing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isRecording ? (
          <Square className="w-4 h-4" />
        ) : (
          <Video className="w-4 h-4" />
        )}
        {isRecording ? '停止' : '录像'}
      </Button>

      {isRecording && (
        <Badge variant="destructive" className="gap-1.5 font-mono text-xs animate-pulse">
          <Circle className="w-2 h-2 fill-current" />
          {formatTime(elapsed)}
        </Badge>
      )}
    </div>
  );
}
