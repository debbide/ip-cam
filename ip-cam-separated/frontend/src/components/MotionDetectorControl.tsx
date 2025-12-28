import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MotionDetectorControlProps {
  isDetecting: boolean;
  motionDetected: boolean;
  motionLevel: number;
  onToggle: () => void;
  compact?: boolean;
}

export function MotionDetectorControl({
  isDetecting,
  motionDetected,
  motionLevel,
  onToggle,
  compact = false,
}: MotionDetectorControlProps) {
  if (compact) {
    return (
      <Button
        variant={isDetecting ? (motionDetected ? 'destructive' : 'secondary') : 'ghost'}
        size="sm"
        onClick={onToggle}
        className={cn(
          'gap-1.5 h-8',
          motionDetected && 'animate-pulse'
        )}
      >
        {motionDetected ? (
          <AlertTriangle className="w-3 h-3" />
        ) : (
          <Activity className="w-3 h-3" />
        )}
        <span className="text-xs">
          {isDetecting ? (motionDetected ? '告警' : '侦测中') : '侦测'}
        </span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isDetecting ? 'secondary' : 'outline'}
        size="sm"
        onClick={onToggle}
        className="gap-2"
      >
        <Activity className={cn('w-4 h-4', isDetecting && 'text-primary')} />
        {isDetecting ? '关闭侦测' : '移动侦测'}
      </Button>
      
      {isDetecting && (
        <Badge 
          variant={motionDetected ? 'destructive' : 'secondary'}
          className={cn(
            'gap-1.5 font-mono text-xs',
            motionDetected && 'animate-pulse'
          )}
        >
          {motionDetected ? (
            <>
              <AlertTriangle className="w-3 h-3" />
              移动 {(motionLevel * 100).toFixed(0)}%
            </>
          ) : (
            <>
              <Activity className="w-3 h-3" />
              监控中
            </>
          )}
        </Badge>
      )}
    </div>
  );
}

// Small indicator badge for camera cards
interface MotionIndicatorProps {
  isDetecting: boolean;
  motionDetected: boolean;
}

export function MotionIndicator({ isDetecting, motionDetected }: MotionIndicatorProps) {
  if (!isDetecting) return null;

  return (
    <div 
      className={cn(
        'absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium backdrop-blur-sm',
        motionDetected 
          ? 'bg-destructive/80 text-destructive-foreground animate-pulse' 
          : 'bg-secondary/80 text-secondary-foreground'
      )}
    >
      {motionDetected ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <Activity className="w-3 h-3" />
      )}
      <span className="hidden sm:inline">
        {motionDetected ? '移动' : '侦测'}
      </span>
    </div>
  );
}
