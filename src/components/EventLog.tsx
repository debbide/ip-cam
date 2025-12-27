import { CameraEvent } from '@/types/camera';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  XCircle,
  Wifi,
  WifiOff,
  Volume2,
  Move,
  X,
  ChevronUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useState } from 'react';

interface EventLogProps {
  events: CameraEvent[];
  isMobile?: boolean;
}

export function EventLog({ events, isMobile = false }: EventLogProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getEventIcon = (type: CameraEvent['type']) => {
    const icons = {
      motion: <Move className="w-4 h-4" />,
      audio: <Volume2 className="w-4 h-4" />,
      disconnect: <WifiOff className="w-4 h-4" />,
      connect: <Wifi className="w-4 h-4" />,
      error: <XCircle className="w-4 h-4" />,
    };
    return icons[type];
  };

  const getSeverityStyles = (severity: CameraEvent['severity']) => {
    const styles = {
      info: 'text-primary border-primary/30 bg-primary/5',
      warning: 'text-warning border-warning/30 bg-warning/5',
      error: 'text-destructive border-destructive/30 bg-destructive/5',
    };
    return styles[severity];
  };

  const getSeverityBadge = (severity: CameraEvent['severity']) => {
    const config = {
      info: { label: '信息', variant: 'secondary' as const },
      warning: { label: '警告', variant: 'warning' as const },
      error: { label: '错误', variant: 'destructive' as const },
    };
    return config[severity];
  };

  // Mobile collapsed view
  if (isMobile && !isExpanded) {
    const latestWarnings = events.filter(e => e.severity !== 'info').slice(0, 2);
    
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border">
        <button 
          onClick={() => setIsExpanded(true)}
          className="w-full p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">事件日志</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {events.length}
            </Badge>
          </div>
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        </button>
        
        {latestWarnings.length > 0 && (
          <div className="px-3 pb-3 space-y-1">
            {latestWarnings.map((event) => (
              <div 
                key={event.id}
                className={`p-2 rounded text-xs flex items-center gap-2 ${getSeverityStyles(event.severity)}`}
              >
                {getEventIcon(event.type)}
                <span className="truncate flex-1">{event.cameraName}: {event.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Mobile expanded view
  if (isMobile && isExpanded) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            事件日志
          </h3>
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {events.map((event) => (
              <EventItem 
                key={event.id} 
                event={event} 
                getEventIcon={getEventIcon}
                getSeverityStyles={getSeverityStyles}
                getSeverityBadge={getSeverityBadge}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Desktop view
  return (
    <div className="h-full flex flex-col bg-card rounded-lg border border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          事件日志
        </h3>
        <Badge variant="secondary" className="font-mono">
          {events.length} 条记录
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {events.map((event) => (
            <EventItem 
              key={event.id} 
              event={event} 
              getEventIcon={getEventIcon}
              getSeverityStyles={getSeverityStyles}
              getSeverityBadge={getSeverityBadge}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface EventItemProps {
  event: CameraEvent;
  getEventIcon: (type: CameraEvent['type']) => JSX.Element;
  getSeverityStyles: (severity: CameraEvent['severity']) => string;
  getSeverityBadge: (severity: CameraEvent['severity']) => { label: string; variant: 'secondary' | 'warning' | 'destructive' };
}

function EventItem({ event, getEventIcon, getSeverityStyles, getSeverityBadge }: EventItemProps) {
  return (
    <div className={`p-3 rounded-lg border ${getSeverityStyles(event.severity)} transition-all hover:scale-[1.01]`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {getEventIcon(event.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm truncate">
              {event.cameraName}
            </span>
            <Badge 
              variant={getSeverityBadge(event.severity).variant}
              className="text-[10px] px-1.5 py-0 h-4"
            >
              {getSeverityBadge(event.severity).label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {event.message}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
            {formatDistanceToNow(event.timestamp, { addSuffix: true, locale: zhCN })}
          </p>
        </div>
      </div>
    </div>
  );
}
