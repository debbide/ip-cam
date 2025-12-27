import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { VideoOff, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MjpegPlayerProps {
  url: string;
  isOnline: boolean;
  className?: string;
  rotation?: number;
}

export interface MjpegPlayerRef {
  getImageElement: () => HTMLImageElement | null;
}

export const MjpegPlayer = forwardRef<MjpegPlayerRef, MjpegPlayerProps>(({ url, isOnline, className = '', rotation = 0 }, ref) => {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  // Expose the image element via ref
  useImperativeHandle(ref, () => ({
    getImageElement: () => imgRef.current,
  }));

  // Generate URL with cache-busting for retry
  const streamUrl = `${url}?t=${retryCount}`;

  useEffect(() => {
    if (!isOnline) {
      setStatus('error');
      return;
    }
    setStatus('loading');
  }, [isOnline, url, retryCount]);

  const handleLoad = () => {
    setStatus('connected');
  };

  const handleError = () => {
    setStatus('error');
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRetryCount(prev => prev + 1);
    setStatus('loading');
  };

  return (
    <div className={`relative w-full h-full bg-secondary/50 overflow-hidden ${className}`}>
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanline opacity-20 pointer-events-none z-10" />

      {/* Corner brackets */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-primary/50" />
        <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-primary/50" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-primary/50" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-primary/50" />
      </div>

      {/* MJPEG Stream */}
      {isOnline && status !== 'error' && (
        <img
          ref={imgRef}
          src={streamUrl}
          alt="Camera feed"
          className="w-full h-full object-cover transition-transform duration-300"
          style={{ transform: `rotate(${rotation}deg)` }}
          onLoad={handleLoad}
          onError={handleError}
          crossOrigin="anonymous"
        />
      )}

      {/* Loading State */}
      {status === 'loading' && isOnline && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-primary text-sm font-mono">连接中...</span>
          <span className="text-muted-foreground text-xs font-mono mt-1">MJPEG Stream</span>
        </div>
      )}

      {/* Error / Offline State */}
      {(status === 'error' || !isOnline) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80">
          {!isOnline ? (
            <>
              <WifiOff className="w-10 h-10 text-destructive/60 mb-3" />
              <span className="text-destructive/80 text-sm font-mono">设备离线</span>
            </>
          ) : (
            <>
              <VideoOff className="w-10 h-10 text-muted-foreground/60 mb-3" />
              <span className="text-muted-foreground text-sm font-mono mb-3">无法连接视频流</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="gap-2 text-xs"
              >
                <RefreshCw className="w-3 h-3" />
                重试连接
              </Button>
            </>
          )}
        </div>
      )}

      {/* Connection indicator */}
      {status === 'connected' && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-background/60 rounded text-xs font-mono z-20">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-success">LIVE</span>
        </div>
      )}
    </div>
  );
});

MjpegPlayer.displayName = 'MjpegPlayer';
