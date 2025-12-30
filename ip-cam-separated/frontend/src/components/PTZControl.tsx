import { useState } from 'react';
import { nativeFetch } from '@/utils/nativeHttp';
import { Button } from '@/components/ui/button';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Home,
  Move
} from 'lucide-react';
import { toast } from 'sonner';

interface PTZControlProps {
  baseUrl: string;
  isOnline: boolean;
  compact?: boolean;
}

type PTZDirection = 'up' | 'down' | 'left' | 'right' | 'up_left' | 'up_right' | 'down_left' | 'down_right';
type PTZZoom = 'in' | 'out';

export function PTZControl({ baseUrl, isOnline, compact = false }: PTZControlProps) {
  const [isMoving, setIsMoving] = useState(false);

  // IP Webcam PTZ API endpoints
  const sendPTZCommand = async (command: string) => {
    if (!isOnline) {
      toast.error('摄像头离线，无法控制');
      return;
    }

    setIsMoving(true);
    try {
      // IP Webcam uses these endpoints for PTZ control
      const response = await nativeFetch(`${baseUrl}/ptz?${command}`, {
        method: 'GET',
        mode: 'no-cors', // IP Webcam doesn't support CORS
      });

      // Since we're using no-cors, we can't read the response
      // Just assume success if no error thrown
    } catch (error) {
      console.error('PTZ command failed:', error);
      toast.error('PTZ 控制命令失败');
    } finally {
      setIsMoving(false);
    }
  };

  const handleMove = (direction: PTZDirection) => {
    // IP Webcam PTZ direction commands
    const directionMap: Record<PTZDirection, string> = {
      up: 'move=up',
      down: 'move=down',
      left: 'move=left',
      right: 'move=right',
      up_left: 'move=up_left',
      up_right: 'move=up_right',
      down_left: 'move=down_left',
      down_right: 'move=down_right',
    };
    sendPTZCommand(directionMap[direction]);
  };

  const handleZoom = (zoom: PTZZoom) => {
    sendPTZCommand(zoom === 'in' ? 'zoom=in' : 'zoom=out');
  };

  const handleHome = () => {
    sendPTZCommand('reset');
  };

  const buttonSize = compact ? 'h-8 w-8' : 'h-10 w-10';
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={`${buttonSize} text-foreground/80 hover:text-foreground hover:bg-accent`}
          onClick={() => handleMove('left')}
          disabled={!isOnline || isMoving}
        >
          <ChevronLeft className={iconSize} />
        </Button>
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-foreground/80 hover:text-foreground hover:bg-accent"
            onClick={() => handleMove('up')}
            disabled={!isOnline || isMoving}
          >
            <ChevronUp className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-foreground/80 hover:text-foreground hover:bg-accent"
            onClick={() => handleMove('down')}
            disabled={!isOnline || isMoving}
          >
            <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={`${buttonSize} text-foreground/80 hover:text-foreground hover:bg-accent`}
          onClick={() => handleMove('right')}
          disabled={!isOnline || isMoving}
        >
          <ChevronRight className={iconSize} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 bg-card/80 backdrop-blur-sm rounded-lg border border-border">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Move className="w-4 h-4" />
        <span>云台控制</span>
      </div>

      {/* Direction Controls */}
      <div className="grid grid-cols-3 gap-1 place-items-center">
        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => handleMove('up_left')}
          disabled={!isOnline || isMoving}
        >
          <ChevronUp className={`${iconSize} -rotate-45`} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => handleMove('up')}
          disabled={!isOnline || isMoving}
        >
          <ChevronUp className={iconSize} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => handleMove('up_right')}
          disabled={!isOnline || isMoving}
        >
          <ChevronUp className={`${iconSize} rotate-45`} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => handleMove('left')}
          disabled={!isOnline || isMoving}
        >
          <ChevronLeft className={iconSize} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={handleHome}
          disabled={!isOnline || isMoving}
        >
          <Home className={iconSize} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => handleMove('right')}
          disabled={!isOnline || isMoving}
        >
          <ChevronRight className={iconSize} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => handleMove('down_left')}
          disabled={!isOnline || isMoving}
        >
          <ChevronDown className={`${iconSize} rotate-45`} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => handleMove('down')}
          disabled={!isOnline || isMoving}
        >
          <ChevronDown className={iconSize} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => handleMove('down_right')}
          disabled={!isOnline || isMoving}
        >
          <ChevronDown className={`${iconSize} -rotate-45`} />
        </Button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => handleZoom('out')}
          disabled={!isOnline || isMoving}
        >
          <ZoomOut className={iconSize} />
        </Button>
        <span className="text-xs text-muted-foreground px-2">缩放</span>
        <Button
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => handleZoom('in')}
          disabled={!isOnline || isMoving}
        >
          <ZoomIn className={iconSize} />
        </Button>
      </div>

      {!isOnline && (
        <p className="text-xs text-muted-foreground text-center">
          摄像头离线
        </p>
      )}
    </div>
  );
}
