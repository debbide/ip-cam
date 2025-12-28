import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

interface VolumeControlProps {
    onVolumeChange: (volume: number) => void;
    onMuteToggle: (muted: boolean) => void;
    initialMuted?: boolean;
    initialVolume?: number;
    compact?: boolean;
}

export function VolumeControl({
    onVolumeChange,
    onMuteToggle,
    initialMuted = true,
    initialVolume = 1.0,
    compact = false
}: VolumeControlProps) {
    const [volume, setVolume] = useState(initialVolume);
    const [isMuted, setIsMuted] = useState(initialMuted);
    const [prevVolume, setPrevVolume] = useState(initialVolume);

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        console.log('[VolumeControl] Volume changed:', newVolume);
        setVolume(newVolume);

        if (newVolume > 0 && isMuted) {
            setIsMuted(false);
            onMuteToggle(false);
        } else if (newVolume === 0 && !isMuted) {
            setIsMuted(true);
            onMuteToggle(true);
        }

        onVolumeChange(newVolume);
    };

    const handleMuteToggle = () => {
        console.log('[VolumeControl] Mute toggle clicked, current isMuted:', isMuted);
        if (isMuted) {
            // 取消静音
            setIsMuted(false);
            onMuteToggle(false);
            const restoreVol = prevVolume > 0 ? prevVolume : 0.5;
            setVolume(restoreVol);
            onVolumeChange(restoreVol);
        } else {
            // 静音
            setPrevVolume(volume);
            setIsMuted(true);
            onMuteToggle(true);
            setVolume(0);
            onVolumeChange(0);
        }
    };

    const getVolumeIcon = () => {
        if (isMuted || volume === 0) {
            return <VolumeX className="w-4 h-4" />;
        } else if (volume < 0.5) {
            return <Volume1 className="w-4 h-4" />;
        } else {
            return <Volume2 className="w-4 h-4" />;
        }
    };

    if (compact) {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={isMuted ? "ghost" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                    >
                        {getVolumeIcon()}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3" side="top">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={handleMuteToggle}
                        >
                            {getVolumeIcon()}
                        </Button>
                        <Slider
                            value={[volume]}
                            max={1}
                            step={0.01}
                            onValueChange={handleVolumeChange}
                            className="flex-1"
                        />
                        <span className="text-xs font-mono w-8 text-right">
                            {Math.round(volume * 100)}
                        </span>
                    </div>
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Button
                variant={isMuted ? "ghost" : "outline"}
                size="icon"
                className="h-9 w-9"
                onClick={handleMuteToggle}
            >
                {getVolumeIcon()}
            </Button>
            <div className="w-24">
                <Slider
                    value={[volume]}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                />
            </div>
            <span className="text-xs font-mono w-8 text-muted-foreground">
                {Math.round(volume * 100)}%
            </span>
        </div>
    );
}
