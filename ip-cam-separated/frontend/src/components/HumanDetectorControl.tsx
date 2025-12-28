import { Button } from '@/components/ui/button';
import { User, UserCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface HumanDetectorControlProps {
    isDetecting: boolean;
    humanDetected: boolean;
    detectionCount: number;
    isModelLoading: boolean;
    onToggle: () => void;
    compact?: boolean;
}

export function HumanDetectorControl({
    isDetecting,
    humanDetected,
    detectionCount,
    isModelLoading,
    onToggle,
    compact = false
}: HumanDetectorControlProps) {
    if (compact) {
        return (
            <Button
                variant={isDetecting ? "destructive" : "ghost"}
                size="icon"
                className="relative h-9 w-9"
                onClick={onToggle}
                disabled={isModelLoading}
            >
                {isModelLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : humanDetected ? (
                    <UserCheck className="w-5 h-5" />
                ) : (
                    <User className="w-5 h-5" />
                )}
                {isDetecting && humanDetected && (
                    <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 px-1 py-0 text-[10px] animate-pulse"
                    >
                        {detectionCount}
                    </Badge>
                )}
            </Button>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Button
                variant={isDetecting ? "destructive" : "outline"}
                size="sm"
                className="gap-2"
                onClick={onToggle}
                disabled={isModelLoading}
            >
                {isModelLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : humanDetected ? (
                    <UserCheck className="w-4 h-4" />
                ) : (
                    <User className="w-4 h-4" />
                )}
                {isModelLoading ? '加载AI...' : isDetecting ? '人形侦测中' : '人形侦测'}
            </Button>
            {isDetecting && humanDetected && (
                <Badge variant="destructive" className="animate-pulse">
                    检测到 {detectionCount} 人
                </Badge>
            )}
        </div>
    );
}
