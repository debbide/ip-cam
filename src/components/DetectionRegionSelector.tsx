import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, DetectionRegion } from '@/types/camera';
import { Button } from '@/components/ui/button';
import { MjpegPlayer } from '@/components/MjpegPlayer';
import { HlsPlayer } from '@/components/HlsPlayer';
import { FlvPlayer } from '@/components/FlvPlayer';
import { WebrtcPlayer } from '@/components/WebrtcPlayer';
import { X, Check, RefreshCw } from 'lucide-react';

interface DetectionRegionSelectorProps {
    camera: Camera;
    initialRegion?: DetectionRegion;
    onSave: (region: DetectionRegion | undefined) => void;
    onCancel: () => void;
}

export function DetectionRegionSelector({
    camera,
    initialRegion,
    onSave,
    onCancel,
}: DetectionRegionSelectorProps) {
    const [region, setRegion] = useState<DetectionRegion | undefined>(initialRegion);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 转换鼠标坐标为归一化坐标 (0-1)
    const getNormalizedPoint = (e: React.MouseEvent | MouseEvent) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        return { x, y };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const point = getNormalizedPoint(e);
        setStartPos(point);
        setIsDrawing(true);
        setRegion({
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
        });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDrawing || !startPos) return;

        const current = getNormalizedPoint(e);

        const x = Math.min(startPos.x, current.x);
        const y = Math.min(startPos.y, current.y);
        const width = Math.abs(current.x - startPos.x);
        const height = Math.abs(current.y - startPos.y);

        setRegion({ x, y, width, height });
    }, [isDrawing, startPos]);

    const handleMouseUp = useCallback(() => {
        setIsDrawing(false);
        setStartPos(null);
    }, []);

    useEffect(() => {
        if (isDrawing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDrawing, handleMouseMove, handleMouseUp]);

    const handleReset = () => {
        setRegion(undefined);
    };

    const renderPlayer = () => {
        // 简化版播放器，只用于预览
        // 注意：这里直接复用现有播放器组件，但可能需要禁用控制条等
        if (camera.streamType === 'hls' && camera.hlsUrl) {
            return <HlsPlayer url={camera.hlsUrl} isOnline={true} />;
        }
        if (camera.streamType === 'flv' && camera.streamUrl) {
            return <FlvPlayer url={camera.streamUrl} isOnline={true} />;
        }
        if (camera.streamType === 'webrtc' && camera.webrtcUrl) {
            return <WebrtcPlayer url={camera.webrtcUrl} isOnline={true} />;
        }
        return <MjpegPlayer url={camera.mjpegUrl} isOnline={true} />;
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">设置检测区域</h3>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重置 (全屏)
                    </Button>
                </div>
            </div>

            <div className="relative flex-1 min-h-[300px] bg-black rounded-lg overflow-hidden select-none" ref={containerRef}>
                {/* 视频层 */}
                <div className="absolute inset-0 pointer-events-none">
                    {renderPlayer()}
                </div>

                {/* 交互层 */}
                <div
                    className="absolute inset-0 cursor-crosshair z-10"
                    onMouseDown={handleMouseDown}
                >
                    {/* 遮罩层 - 区域外变暗 */}
                    {region && (
                        <>
                            {/* 上 */}
                            <div
                                className="absolute bg-black/50 pointer-events-none"
                                style={{
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: `${region.y * 100}%`
                                }}
                            />
                            {/* 下 */}
                            <div
                                className="absolute bg-black/50 pointer-events-none"
                                style={{
                                    top: `${(region.y + region.height) * 100}%`,
                                    left: 0,
                                    right: 0,
                                    bottom: 0
                                }}
                            />
                            {/* 左 */}
                            <div
                                className="absolute bg-black/50 pointer-events-none"
                                style={{
                                    top: `${region.y * 100}%`,
                                    left: 0,
                                    width: `${region.x * 100}%`,
                                    height: `${region.height * 100}%`
                                }}
                            />
                            {/* 右 */}
                            <div
                                className="absolute bg-black/50 pointer-events-none"
                                style={{
                                    top: `${region.y * 100}%`,
                                    left: `${(region.x + region.width) * 100}%`,
                                    right: 0,
                                    height: `${region.height * 100}%`
                                }}
                            />

                            {/* 选中区域边框 */}
                            <div
                                className="absolute border-2 border-primary pointer-events-none box-border"
                                style={{
                                    top: `${region.y * 100}%`,
                                    left: `${region.x * 100}%`,
                                    width: `${region.width * 100}%`,
                                    height: `${region.height * 100}%`
                                }}
                            >
                                <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] px-1">
                                    检测区域
                                </div>
                            </div>
                        </>
                    )}

                    {!region && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/50 text-white px-3 py-1 rounded text-sm backdrop-blur-sm">
                                拖拽绘制检测区域
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onCancel}>
                    <X className="w-4 h-4 mr-2" />
                    取消
                </Button>
                <Button onClick={() => onSave(region)}>
                    <Check className="w-4 h-4 mr-2" />
                    确认
                </Button>
            </div>
        </div>
    );
}
