import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Volume2, 
  VolumeX, 
  Volume1,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface AudioPlayerProps {
  audioUrl: string;
  isEnabled: boolean;
  isOnline: boolean;
  compact?: boolean;
}

export function AudioPlayer({ audioUrl, isEnabled, isOnline, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted to prevent autoplay issues
  const [volume, setVolume] = useState(0.7);
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [retryCount, setRetryCount] = useState(0);

  // Create audio element on mount
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    audio.onloadstart = () => setStatus('loading');
    audio.oncanplay = () => {
      setStatus('playing');
      if (!isMuted && isPlaying) {
        audio.play().catch(console.error);
      }
    };
    audio.onerror = () => setStatus('error');
    audio.onended = () => setIsPlaying(false);

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update audio source when URL changes
  useEffect(() => {
    if (!audioRef.current || !isEnabled || !isOnline) return;
    
    const audio = audioRef.current;
    const urlWithCacheBust = `${audioUrl}?t=${retryCount}`;
    
    if (isPlaying && !isMuted) {
      audio.src = urlWithCacheBust;
      audio.load();
      audio.play().catch(console.error);
    }
  }, [audioUrl, isEnabled, isOnline, isPlaying, isMuted, retryCount]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle mute state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      
      if (isMuted) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isMuted]);

  const toggleAudio = useCallback(() => {
    if (!audioRef.current || !isEnabled || !isOnline) return;

    if (isMuted) {
      // Unmute and start playing
      setIsMuted(false);
      setIsPlaying(true);
      audioRef.current.src = `${audioUrl}?t=${Date.now()}`;
      audioRef.current.load();
      audioRef.current.play().catch((e) => {
        console.error('Audio play failed:', e);
        setStatus('error');
      });
    } else {
      // Mute and stop
      setIsMuted(true);
      setIsPlaying(false);
      audioRef.current.pause();
    }
  }, [audioUrl, isEnabled, isOnline, isMuted]);

  const handleVolumeChange = useCallback((value: number[]) => {
    setVolume(value[0]);
    if (value[0] === 0) {
      setIsMuted(true);
    } else if (isMuted && value[0] > 0) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const retry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setStatus('loading');
  }, []);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="w-4 h-4" />;
    if (volume < 0.5) return <Volume1 className="w-4 h-4" />;
    return <Volume2 className="w-4 h-4" />;
  };

  const getStatusColor = () => {
    if (!isEnabled || !isOnline) return 'text-muted-foreground/50';
    if (status === 'error') return 'text-destructive';
    if (status === 'loading') return 'text-warning';
    if (isPlaying && !isMuted) return 'text-primary';
    return 'text-muted-foreground';
  };

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-8 w-8 ${getStatusColor()}`}
            disabled={!isEnabled || !isOnline}
          >
            {status === 'loading' && isPlaying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              getVolumeIcon()
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">音频监控</span>
              {isPlaying && !isMuted && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  播放中
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant={isMuted ? "outline" : "default"} 
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={toggleAudio}
                disabled={!isEnabled || !isOnline}
              >
                {getVolumeIcon()}
              </Button>
              
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                disabled={!isEnabled || !isOnline}
                className="flex-1"
              />
              
              <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>

            {status === 'error' && (
              <div className="flex items-center justify-between p-2 rounded bg-destructive/10 text-destructive text-xs">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  音频连接失败
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={retry}>
                  重试
                </Button>
              </div>
            )}

            {(!isEnabled || !isOnline) && (
              <p className="text-xs text-muted-foreground">
                {!isOnline ? '设备离线，无法播放音频' : '此设备未启用音频'}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Full-size version for fullscreen viewer
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
      <Button 
        variant={isMuted ? "outline" : "default"} 
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={toggleAudio}
        disabled={!isEnabled || !isOnline}
      >
        {status === 'loading' && isPlaying ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          getVolumeIcon()
        )}
      </Button>
      
      <div className="flex-1 min-w-32">
        <Slider
          value={[isMuted ? 0 : volume]}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          disabled={!isEnabled || !isOnline}
        />
      </div>
      
      <span className="text-xs font-mono text-muted-foreground w-10 text-right">
        {Math.round((isMuted ? 0 : volume) * 100)}%
      </span>

      {isPlaying && !isMuted && (
        <div className="flex items-center gap-1 ml-2">
          <div className="flex items-end gap-0.5 h-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.1}s`,
                  minHeight: '20%',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
