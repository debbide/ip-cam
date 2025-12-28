import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Circle, 
  Square, 
  Pause,
  Play
} from 'lucide-react';

interface RecordingControlProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  startTime?: Date;
  compact?: boolean;
}

export function RecordingControl({ 
  isRecording, 
  onToggleRecording, 
  startTime,
  compact = false 
}: RecordingControlProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording || !startTime) {
      setElapsed(0);
      return;
    }

    // Calculate initial elapsed time
    setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));

    // Update every second
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, startTime]);

  const formatTime = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant={isRecording ? "destructive" : "outline"}
          size="sm"
          className="h-8 gap-1.5"
          onClick={onToggleRecording}
        >
          {isRecording ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              <span className="text-xs">停止</span>
            </>
          ) : (
            <>
              <Circle className="w-3 h-3 fill-destructive text-destructive" />
              <span className="text-xs">录制</span>
            </>
          )}
        </Button>
        
        {isRecording && (
          <Badge variant="destructive" className="gap-1.5 font-mono text-xs animate-pulse">
            <Circle className="w-2 h-2 fill-current animate-recording" />
            {formatTime(elapsed)}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
      <Button
        variant={isRecording ? "destructive" : "default"}
        size="sm"
        className="gap-2"
        onClick={onToggleRecording}
      >
        {isRecording ? (
          <>
            <Square className="w-4 h-4 fill-current" />
            停止录制
          </>
        ) : (
          <>
            <Circle className="w-4 h-4 fill-destructive text-destructive" />
            开始录制
          </>
        )}
      </Button>
      
      {isRecording && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Circle className="w-2.5 h-2.5 fill-destructive text-destructive animate-recording" />
            <span className="text-destructive text-sm font-medium">REC</span>
          </div>
          <span className="font-mono text-sm text-foreground bg-background/50 px-2 py-0.5 rounded">
            {formatTime(elapsed)}
          </span>
        </div>
      )}

      {!isRecording && (
        <span className="text-sm text-muted-foreground">
          准备就绪
        </span>
      )}
    </div>
  );
}

// Recording badge for camera cards
interface RecordingBadgeProps {
  isRecording: boolean;
  startTime?: Date;
  onClick?: () => void;
}

export function RecordingBadge({ isRecording, startTime, onClick }: RecordingBadgeProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording || !startTime) {
      setElapsed(0);
      return;
    }

    setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <button 
        onClick={onClick}
        className="flex items-center gap-1.5 px-2 py-0.5 bg-secondary/80 backdrop-blur-sm rounded hover:bg-secondary transition-colors"
      >
        <Circle className="w-2.5 h-2.5 text-muted-foreground" />
        <span className="text-xs font-mono text-muted-foreground">REC</span>
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-0.5 bg-destructive/20 backdrop-blur-sm rounded hover:bg-destructive/30 transition-colors group"
    >
      <Circle className="w-2.5 h-2.5 fill-destructive text-destructive animate-recording" />
      <span className="text-xs font-mono text-destructive">{formatTime(elapsed)}</span>
      <Square className="w-2.5 h-2.5 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
