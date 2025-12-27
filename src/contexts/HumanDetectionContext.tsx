import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Camera, DetectionRegion } from '@/types/camera';
import { MotionEvent, addEventToStorage } from '@/components/MotionEventLog';
import { toast } from 'sonner';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

interface DetectionState {
    isDetecting: boolean;
    humanDetected: boolean;
    detectionCount: number;
    isModelLoading: boolean;
}

interface HumanDetectionContextType {
    // 获取指定摄像头的检测状态
    getDetectionState: (cameraId: string) => DetectionState;
    // 注册视频元素用于检测
    registerVideoElement: (cameraId: string, element: HTMLVideoElement | null) => void;
    // 开启/关闭检测
    toggleDetection: (cameraId: string, cameraName: string, enabled: boolean, region?: DetectionRegion) => void;
    // 更新检测区域
    updateDetectionRegion: (cameraId: string, region: DetectionRegion | undefined) => void;
    // 获取检测区域
    getDetectionRegion: (cameraId: string) => DetectionRegion | undefined;
    // 模型加载状态
    isModelLoading: boolean;
}

const HumanDetectionContext = createContext<HumanDetectionContextType | null>(null);

export function useHumanDetection() {
    const context = useContext(HumanDetectionContext);
    if (!context) {
        throw new Error('useHumanDetection must be used within HumanDetectionProvider');
    }
    return context;
}

interface HumanDetectionProviderProps {
    children: React.ReactNode;
    cameras: Camera[];
    onHumanDetected?: (cameraId: string, event: MotionEvent) => void;
}

export function HumanDetectionProvider({ children, cameras, onHumanDetected }: HumanDetectionProviderProps) {
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [detectionStates, setDetectionStates] = useState<Record<string, DetectionState>>({});
    const [detectionRegions, setDetectionRegions] = useState<Record<string, DetectionRegion | undefined>>({});

    const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
    const videoElementsRef = useRef<Record<string, HTMLVideoElement | null>>({});
    const intervalsRef = useRef<Record<string, number>>({});
    const lastAlertTimeRef = useRef<Record<string, number>>({});

    const CHECK_INTERVAL = 1000; // 1秒检测一次
    const COOLDOWN_TIME = 10000; // 10秒冷却时间
    const CONFIDENCE_THRESHOLD = 0.5; // 50% 置信度

    // 加载模型
    const loadModel = useCallback(async () => {
        if (modelRef.current) return true;

        setIsModelLoading(true);
        try {
            console.log('[HumanDetection] Loading COCO-SSD model...');
            modelRef.current = await cocoSsd.load({
                base: 'lite_mobilenet_v2'
            });
            console.log('[HumanDetection] Model loaded successfully');
            return true;
        } catch (error) {
            console.error('[HumanDetection] Failed to load model:', error);
            toast.error('AI 模型加载失败');
            return false;
        } finally {
            setIsModelLoading(false);
        }
    }, []);

    // 检查检测结果是否在指定区域内
    const isInRegion = useCallback((
        bbox: [number, number, number, number], // [x, y, width, height]
        videoWidth: number,
        videoHeight: number,
        region?: DetectionRegion
    ): boolean => {
        if (!region) return true; // 没有限定区域则全画面检测

        // 将检测框坐标转换为相对值
        const [bx, by, bw, bh] = bbox;
        const relX = bx / videoWidth;
        const relY = by / videoHeight;
        const relW = bw / videoWidth;
        const relH = bh / videoHeight;

        // 计算检测框中心点
        const centerX = relX + relW / 2;
        const centerY = relY + relH / 2;

        // 检查中心点是否在区域内
        return (
            centerX >= region.x &&
            centerX <= region.x + region.width &&
            centerY >= region.y &&
            centerY <= region.y + region.height
        );
    }, []);

    // 执行检测
    const detectHumans = useCallback(async (cameraId: string, cameraName: string) => {
        const video = videoElementsRef.current[cameraId];
        const model = modelRef.current;
        const region = detectionRegions[cameraId];

        if (!video || !model || video.readyState < 2 || video.videoWidth === 0) {
            return;
        }

        try {
            const predictions = await model.detect(video);

            // 过滤出人形，并检查是否在指定区域内
            const humans = predictions.filter(p =>
                p.class === 'person' &&
                p.score >= CONFIDENCE_THRESHOLD &&
                isInRegion(p.bbox as [number, number, number, number], video.videoWidth, video.videoHeight, region)
            );

            if (humans.length > 0) {
                setDetectionStates(prev => ({
                    ...prev,
                    [cameraId]: {
                        ...prev[cameraId],
                        humanDetected: true,
                        detectionCount: humans.length
                    }
                }));

                // 冷却时间内不重复告警
                const now = Date.now();
                const lastAlert = lastAlertTimeRef.current[cameraId] || 0;

                if (now - lastAlert > COOLDOWN_TIME) {
                    lastAlertTimeRef.current[cameraId] = now;

                    const event: MotionEvent = {
                        id: `human-${now}-${Math.random().toString(36).substr(2, 9)}`,
                        cameraName,
                        cameraId,
                        timestamp: new Date(),
                        motionLevel: humans[0].score,
                    };

                    addEventToStorage(event);
                    onHumanDetected?.(cameraId, event);

                    toast.warning('人形侦测告警', {
                        description: `${cameraName} 检测到 ${humans.length} 人 (置信度: ${(humans[0].score * 100).toFixed(0)}%)`,
                        duration: 5000,
                    });

                    // 自动抓拍
                    try {
                        const { saveScreenshot } = await import('@/utils/fileSaver');
                        const result = await saveScreenshot(video, cameraName, '人形检测', '人形检测');
                        if (result.success) {
                            console.log(`[HumanDetection] Auto-captured: ${result.path || 'saved'}`);
                        }
                    } catch (error) {
                        console.error('[HumanDetection] Auto-capture failed:', error);
                    }
                }
            } else {
                setDetectionStates(prev => ({
                    ...prev,
                    [cameraId]: {
                        ...prev[cameraId],
                        humanDetected: false,
                        detectionCount: 0
                    }
                }));
            }
        } catch (e) {
            console.debug('[HumanDetection] Detection error:', e);
        }
    }, [detectionRegions, isInRegion, onHumanDetected]);

    // 注册视频元素
    const registerVideoElement = useCallback((cameraId: string, element: HTMLVideoElement | null) => {
        videoElementsRef.current[cameraId] = element;
    }, []);

    // 获取检测状态
    const getDetectionState = useCallback((cameraId: string): DetectionState => {
        return detectionStates[cameraId] || {
            isDetecting: false,
            humanDetected: false,
            detectionCount: 0,
            isModelLoading: false
        };
    }, [detectionStates]);

    // 开关检测
    const toggleDetection = useCallback(async (
        cameraId: string,
        cameraName: string,
        enabled: boolean,
        region?: DetectionRegion
    ) => {
        if (enabled) {
            // 开启检测
            const loaded = await loadModel();
            if (!loaded) return;

            if (region) {
                setDetectionRegions(prev => ({ ...prev, [cameraId]: region }));
            }

            setDetectionStates(prev => ({
                ...prev,
                [cameraId]: {
                    isDetecting: true,
                    humanDetected: false,
                    detectionCount: 0,
                    isModelLoading: false
                }
            }));

            // 清除旧的定时器
            if (intervalsRef.current[cameraId]) {
                clearInterval(intervalsRef.current[cameraId]);
            }

            // 启动定时检测
            intervalsRef.current[cameraId] = window.setInterval(() => {
                detectHumans(cameraId, cameraName);
            }, CHECK_INTERVAL);

            toast.success('已开启人形侦测', { description: cameraName });
        } else {
            // 关闭检测
            if (intervalsRef.current[cameraId]) {
                clearInterval(intervalsRef.current[cameraId]);
                delete intervalsRef.current[cameraId];
            }

            setDetectionStates(prev => ({
                ...prev,
                [cameraId]: {
                    isDetecting: false,
                    humanDetected: false,
                    detectionCount: 0,
                    isModelLoading: false
                }
            }));

            toast.info('已关闭人形侦测', { description: cameraName });
        }
    }, [loadModel, detectHumans]);

    // 更新检测区域
    const updateDetectionRegion = useCallback((cameraId: string, region: DetectionRegion | undefined) => {
        setDetectionRegions(prev => ({ ...prev, [cameraId]: region }));
    }, []);

    // 获取检测区域
    const getDetectionRegion = useCallback((cameraId: string): DetectionRegion | undefined => {
        return detectionRegions[cameraId];
    }, [detectionRegions]);

    // 注意：自动启动检测的逻辑已移至 CameraCard 组件，避免重复触发

    // 清理
    useEffect(() => {
        return () => {
            Object.values(intervalsRef.current).forEach(intervalId => {
                clearInterval(intervalId);
            });
        };
    }, []);

    const contextValue: HumanDetectionContextType = {
        getDetectionState,
        registerVideoElement,
        toggleDetection,
        updateDetectionRegion,
        getDetectionRegion,
        isModelLoading
    };

    return (
        <HumanDetectionContext.Provider value={contextValue}>
            {children}
        </HumanDetectionContext.Provider>
    );
}
