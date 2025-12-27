import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Activity,
    Move,
    X,
    ChevronUp,
    Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { loadEventsFromStorage, clearEventsFromStorage, MotionEvent } from '@/components/MotionEventLog';

interface MotionEventLogPanelProps {
    isMobile?: boolean;
}

export function MotionEventLogPanel({ isMobile = false }: MotionEventLogPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [events, setEvents] = useState<MotionEvent[]>([]);

    // 定期刷新事件
    useEffect(() => {
        const loadEvents = () => setEvents(loadEventsFromStorage());
        loadEvents();
        const interval = setInterval(loadEvents, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleClear = () => {
        clearEventsFromStorage();
        setEvents([]);
    };

    // Mobile collapsed view
    if (isMobile && !isExpanded) {
        const latestEvents = events.slice(0, 2);

        return (
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border">
                <button
                    onClick={() => setIsExpanded(true)}
                    className="w-full p-3 flex items-center justify-between"
                >
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">移动侦测</span>
                        {events.length > 0 && (
                            <Badge variant="destructive" className="font-mono text-xs">
                                {events.length}
                            </Badge>
                        )}
                    </div>
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                </button>

                {latestEvents.length > 0 && (
                    <div className="px-3 pb-3 space-y-1">
                        {latestEvents.map((event) => (
                            <div
                                key={event.id}
                                className="p-2 rounded text-xs flex items-center gap-2 text-warning border-warning/30 bg-warning/5"
                            >
                                <Move className="w-4 h-4" />
                                <span className="truncate flex-1">{event.cameraName}: 检测到移动 ({(event.motionLevel * 100).toFixed(1)}%)</span>
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
                        移动侦测事件
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button variant="destructive" size="sm" onClick={handleClear} disabled={events.length === 0}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                        {events.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                <Move className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>暂无移动侦测事件</p>
                            </div>
                        ) : (
                            events.map((event) => (
                                <EventItem key={event.id} event={event} />
                            ))
                        )}
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
                    移动侦测
                </h3>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                        {events.length} 条
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear} disabled={events.length === 0}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                    {events.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <Move className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">暂无事件</p>
                            <p className="text-xs mt-1">开启移动侦测后将在此显示</p>
                        </div>
                    ) : (
                        events.map((event) => (
                            <EventItem key={event.id} event={event} />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

function EventItem({ event }: { event: MotionEvent }) {
    return (
        <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 transition-all hover:scale-[1.01]">
            <div className="flex items-start gap-3">
                <div className="mt-0.5">
                    <Move className="w-4 h-4 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-sm truncate text-warning">
                            {event.cameraName}
                        </span>
                        <Badge
                            variant={event.motionLevel > 0.1 ? "destructive" : "warning"}
                            className="text-[10px] px-1.5 py-0 h-4"
                        >
                            {(event.motionLevel * 100).toFixed(1)}%
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
                        {formatDistanceToNow(event.timestamp, { addSuffix: true, locale: zhCN })}
                    </p>
                </div>
            </div>
        </div>
    );
}
