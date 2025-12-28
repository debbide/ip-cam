import { useRef, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { addEventToStorage, MotionEvent } from '@/components/MotionEventLog';

interface MotionDetectorOptions {
  threshold?: number; // 0-1, sensitivity (lower = more sensitive)
  minMotionPixels?: number; // Minimum pixels that need to change
  checkInterval?: number; // Milliseconds between checks
  cooldownTime?: number; // Milliseconds between alerts
  onMotionEvent?: (event: MotionEvent) => void;
}

interface MotionDetectorResult {
  isDetecting: boolean;
  motionDetected: boolean;
  motionLevel: number;
  startDetection: () => void;
  stopDetection: () => void;
  toggleDetection: () => void;
}

export function useMotionDetector(
  mediaRef: React.RefObject<HTMLImageElement | HTMLVideoElement | null>,
  cameraName: string,
  cameraId: string = '',
  options: MotionDetectorOptions = {}
): MotionDetectorResult {
  const {
    threshold = 30, // Pixel difference threshold (0-255)
    minMotionPixels = 0.01, // 1% of pixels need to change
    checkInterval = 500, // Check every 500ms
    cooldownTime = 5000, // 5 seconds between alerts
    onMotionEvent,
  } = options;

  const [isDetecting, setIsDetecting] = useState(false);
  const [motionDetected, setMotionDetected] = useState(false);
  const [motionLevel, setMotionLevel] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const previousFrameRef = useRef<ImageData | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastAlertRef = useRef<number>(0);

  const checkMotion = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;

    let width = 0;
    let height = 0;

    if (media instanceof HTMLImageElement) {
      if (!media.complete || media.naturalWidth === 0) return;
      width = media.naturalWidth;
      height = media.naturalHeight;
    } else if (media instanceof HTMLVideoElement) {
      if (media.readyState < 2 || media.videoWidth === 0) return;
      width = media.videoWidth;
      height = media.videoHeight;
    }

    // Initialize canvas if needed
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;
    const processWidth = Math.min(width, 320); // Downsample for performance
    const processHeight = Math.round((height / width) * processWidth);

    if (canvas.width !== processWidth || canvas.height !== processHeight) {
      canvas.width = processWidth;
      canvas.height = processHeight;
      ctxRef.current = canvas.getContext('2d', { willReadFrequently: true });
      previousFrameRef.current = null;
    }

    const ctx = ctxRef.current;
    if (!ctx) return;

    try {
      // Draw current frame
      ctx.drawImage(media, 0, 0, processWidth, processHeight);
      const currentFrame = ctx.getImageData(0, 0, processWidth, processHeight);

      // Compare with previous frame
      if (previousFrameRef.current) {
        const prev = previousFrameRef.current.data;
        const curr = currentFrame.data;
        let changedPixels = 0;
        const totalPixels = processWidth * processHeight;

        for (let i = 0; i < prev.length; i += 4) {
          // Compare RGB values (skip alpha)
          const rDiff = Math.abs(prev[i] - curr[i]);
          const gDiff = Math.abs(prev[i + 1] - curr[i + 1]);
          const bDiff = Math.abs(prev[i + 2] - curr[i + 2]);
          const avgDiff = (rDiff + gDiff + bDiff) / 3;

          if (avgDiff > threshold) {
            changedPixels++;
          }
        }

        const motionRatio = changedPixels / totalPixels;
        setMotionLevel(motionRatio);

        // Check if motion exceeds threshold
        if (motionRatio > minMotionPixels) {
          setMotionDetected(true);

          // Send alert if not in cooldown
          const now = Date.now();
          if (now - lastAlertRef.current > cooldownTime) {
            lastAlertRef.current = now;

            // Create and save motion event
            const event: MotionEvent = {
              id: `motion-${now}-${Math.random().toString(36).substr(2, 9)}`,
              cameraName,
              cameraId,
              timestamp: new Date(),
              motionLevel: motionRatio,
            };

            addEventToStorage(event);
            onMotionEvent?.(event);

            toast.warning(`移动侦测告警`, {
              description: `${cameraName} 检测到画面变化 (${(motionRatio * 100).toFixed(1)}%)`,
              duration: 5000,
            });
          }
        } else {
          setMotionDetected(false);
        }
      }

      // Store current frame for next comparison
      previousFrameRef.current = currentFrame;
    } catch (e) {
      // CORS or other errors - ignore
      console.debug('Motion detection frame error:', e);
    }
  }, [mediaRef, cameraName, threshold, minMotionPixels, cooldownTime]);

  const startDetection = useCallback(() => {
    if (intervalRef.current) return;

    setIsDetecting(true);
    previousFrameRef.current = null;

    intervalRef.current = window.setInterval(checkMotion, checkInterval);

    toast.success(`已开启移动侦测`, {
      description: cameraName,
    });
  }, [checkMotion, checkInterval, cameraName]);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsDetecting(false);
    setMotionDetected(false);
    setMotionLevel(0);
    previousFrameRef.current = null;

    toast.info(`已关闭移动侦测`, {
      description: cameraName,
    });
  }, [cameraName]);

  const toggleDetection = useCallback(() => {
    if (isDetecting) {
      stopDetection();
    } else {
      startDetection();
    }
  }, [isDetecting, startDetection, stopDetection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isDetecting,
    motionDetected,
    motionLevel,
    startDetection,
    stopDetection,
    toggleDetection,
  };
}
