import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Download, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ScreenshotControlProps {
  onCapture: () => Promise<Blob | null>;
  cameraName: string;
  isOnline: boolean;
  compact?: boolean;
}

export function ScreenshotControl({ onCapture, cameraName, isOnline, compact = false }: ScreenshotControlProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);

  const handleCapture = async () => {
    if (!isOnline) {
      toast.error('摄像头离线，无法截图');
      return;
    }

    setIsCapturing(true);
    try {
      const blob = await onCapture();
      if (blob) {
        // Create download link
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${cameraName}_${timestamp}.jpg`;

        // Trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Store last capture for preview
        setLastCapture(url);

        toast.success('截图已保存', {
          description: filename,
        });

        // Clean up preview after 3 seconds
        setTimeout(() => {
          setLastCapture(null);
          URL.revokeObjectURL(url);
        }, 3000);
      }
    } catch (error) {
      console.error('Screenshot failed:', error);
      toast.error('截图失败');
    } finally {
      setIsCapturing(false);
    }
  };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleCapture}
        disabled={!isOnline || isCapturing}
      >
        {lastCapture ? (
          <Check className="w-4 h-4 text-success" />
        ) : (
          <Camera className={`w-4 h-4 ${isCapturing ? 'animate-pulse' : ''}`} />
        )}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleCapture}
        disabled={!isOnline || isCapturing}
      >
        {lastCapture ? (
          <>
            <Check className="w-4 h-4 text-success" />
            <span>已保存</span>
          </>
        ) : (
          <>
            <Camera className={`w-4 h-4 ${isCapturing ? 'animate-pulse' : ''}`} />
            <span>截图</span>
          </>
        )}
      </Button>

      {lastCapture && (
        <div className="w-12 h-8 rounded border border-border overflow-hidden">
          <img
            src={lastCapture}
            alt="Last capture"
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

// Utility function to capture screenshot from an image or video element
export async function captureScreenshot(element: HTMLImageElement | HTMLVideoElement | null): Promise<Blob | null> {
  if (!element) return null;

  try {
    // Create a canvas with the same dimensions as the image/video
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    let width = 0;
    let height = 0;

    if (element instanceof HTMLImageElement) {
      width = element.naturalWidth || element.width;
      height = element.naturalHeight || element.height;
    } else if (element instanceof HTMLVideoElement) {
      width = element.videoWidth || element.width;
      height = element.videoHeight || element.height;
    }

    if (width === 0 || height === 0) return null;

    canvas.width = width;
    canvas.height = height;

    // Draw the image/video to canvas
    ctx.drawImage(element, 0, 0, canvas.width, canvas.height);

    // Add timestamp overlay
    const timestamp = new Date().toLocaleString('zh-CN');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, canvas.height - 35, ctx.measureText(timestamp).width + 20, 25);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(timestamp, 20, canvas.height - 18);

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.95
      );
    });
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    return null;
  }
}
