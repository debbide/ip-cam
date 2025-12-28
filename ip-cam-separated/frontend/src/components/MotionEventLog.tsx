import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { History, AlertTriangle, Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';

export interface MotionEvent {
  id: string;
  cameraName: string;
  cameraId: string;
  timestamp: Date;
  motionLevel: number;
}

interface MotionEventLogProps {
  events: MotionEvent[];
  onClearEvents: () => void;
  compact?: boolean;
}

const STORAGE_KEY = 'motion-events';

export function loadEventsFromStorage(): MotionEvent[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp)
      }));
    }
  } catch (e) {
    console.error('Failed to load events from storage:', e);
  }
  return [];
}

export function saveEventsToStorage(events: MotionEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (e) {
    console.error('Failed to save events to storage:', e);
  }
}

export function addEventToStorage(event: MotionEvent): MotionEvent[] {
  const events = loadEventsFromStorage();
  const updated = [event, ...events].slice(0, 100); // Keep last 100 events
  saveEventsToStorage(updated);
  return updated;
}

export function clearEventsFromStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function MotionEventLog({ events, onClearEvents, compact = false }: MotionEventLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const exportEvents = () => {
    const csvContent = [
      ['时间', '摄像头', '变化比例'].join(','),
      ...events.map(e => [
        format(e.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        e.cameraName,
        `${(e.motionLevel * 100).toFixed(1)}%`
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `motion-events-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "default"} className={compact ? "h-9 w-9 relative" : ""}>
          <History className={compact ? "w-5 h-5" : "w-4 h-4 mr-2"} />
          {!compact && "事件日志"}
          {events.length > 0 && (
            <Badge 
              variant="destructive" 
              className={`px-1.5 py-0 text-[10px] ${compact ? 'absolute -top-1 -right-1' : 'ml-1'}`}
            >
              {events.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            移动侦测事件
          </SheetTitle>
          <SheetDescription>
            最近 {events.length} 条告警记录
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={exportEvents}
            disabled={events.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            导出CSV
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={onClearEvents}
            disabled={events.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            清空
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)] mt-4 pr-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">暂无告警记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div 
                  key={event.id}
                  className="p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {event.cameraName}
                        </Badge>
                        <Badge 
                          variant={event.motionLevel > 0.1 ? "destructive" : "secondary"}
                          className="shrink-0"
                        >
                          {(event.motionLevel * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 font-mono">
                        {format(event.timestamp, 'yyyy-MM-dd HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
