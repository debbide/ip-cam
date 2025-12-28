import { useRef, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { addEventToStorage, MotionEvent } from '@/components/MotionEventLog';
import { DetectionRegion } from '@/types/camera';

interface HumanDetectorOptions {
    checkInterval?: number; // Milliseconds between checks
    cooldownTime?: number; // Milliseconds between alerts
    confidenceThreshold?: number; // Minimum confidence to trigger (0-1)
    onHumanDetected?: (event: MotionEvent) => void;
    persistent?: boolean; // 持久模式：组件卸载后继续检测
    detectionRegion?: DetectionRegion; // 检测区域
}

interface HumanDetectorResult {
    isDetecting: boolean;
    humanDetected: boolean;
    detectionCount: number;
    isModelLoading: boolean;
    startDetection: () => void;
    stopDetection: () => void;
    toggleDetection: () => void;
}

// 全局存储：检测 interval 和状态（不随组件卸载而销毁）
const globalIntervals = new Map<string, number>();
const globalDetectionStates = new Map<string, { humanDetected: boolean; detectionCount: number }>();
let globalModel: cocoSsd.ObjectDetection | null = null;
let globalModelLoading = false;

// 加载全局模型
async function loadGlobalModel(): Promise<cocoSsd.ObjectDetection | null> {
    if (globalModel) return globalModel;
    if (globalModelLoading) {
        // 等待加载完成
        while (globalModelLoading) {
            await new Promise(r => setTimeout(r, 100));
        }
        return globalModel;
    }

    globalModelLoading = true;
    try {
        console.log('[HumanDetector] Loading COCO-SSD model...');
        globalModel = await cocoSsd.load({
            base: 'lite_mobilenet_v2'
        });
        console.log('[HumanDetector] Model loaded successfully');
        return globalModel;
    } catch (error) {
        console.error('[HumanDetector] Failed to load model:', error);
        toast.error('AI 模型加载失败');
        return null;
    } finally {
        globalModelLoading = false;
    }
}

export function useHumanDetector(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    cameraName: string,
    cameraId: string = '',
    options: HumanDetectorOptions = {}
): HumanDetectorResult {
    const {
        checkInterval = 1000,
        cooldownTime = 10000,
        confidenceThreshold = 0.5,
        onHumanDetected,
        persistent = true, // 默认开启持久模式
        detectionRegion,
    } = options;

    const [isDetecting, setIsDetecting] = useState(() => globalIntervals.has(cameraId));
    const [humanDetected, setHumanDetected] = useState(() => globalDetectionStates.get(cameraId)?.humanDetected || false);
    const [detectionCount, setDetectionCount] = useState(() => globalDetectionStates.get(cameraId)?.detectionCount || 0);
    const [isModelLoading, setIsModelLoading] = useState(false);

    const lastAlertRef = useRef<number>(0);
    const detectionRegionRef = useRef(detectionRegion);

    // 更新 detectionRegionRef
    useEffect(() => {
        detectionRegionRef.current = detectionRegion;
    }, [detectionRegion]);

    // 同步全局状态到本地状态
    useEffect(() => {
        const interval = setInterval(() => {
            const state = globalDetectionStates.get(cameraId);
            if (state) {
                setHumanDetected(state.humanDetected);
                setDetectionCount(state.detectionCount);
            }
            setIsDetecting(globalIntervals.has(cameraId));
        }, 500);
        return () => clearInterval(interval);
    }, [cameraId]);

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

    const detectHumans = useCallback(async () => {
        const video = videoRef.current;
        const model = globalModel;

        if (!video || !model || video.readyState < 2 || video.videoWidth === 0) {
            return;
        }

        try {
            const predictions = await model.detect(video);
            const humans = predictions.filter(
                p => p.class === 'person' &&
                    p.score >= confidenceThreshold &&
                    isInRegion(p.bbox as [number, number, number, number], video.videoWidth, video.videoHeight, detectionRegionRef.current)
            );

            // 更新全局状态
            globalDetectionStates.set(cameraId, {
                humanDetected: humans.length > 0,
                detectionCount: humans.length
            });

            if (humans.length > 0) {
                setHumanDetected(true);
                setDetectionCount(humans.length);

                const now = Date.now();
                if (now - lastAlertRef.current > cooldownTime) {
                    lastAlertRef.current = now;

                    const event: MotionEvent = {
                        id: `human-${now}-${Math.random().toString(36).substr(2, 9)}`,
                        cameraName,
                        cameraId,
                        timestamp: new Date(),
                        motionLevel: humans[0].score,
                    };

                    addEventToStorage(event);
                    onHumanDetected?.(event);

                    toast.warning(`人形侦测告警`, {
                        description: `${cameraName} 检测到 ${humans.length} 人 (置信度: ${(humans[0].score * 100).toFixed(0)}%)`,
                        duration: 5000,
                    });

                    // 自动抓拍
                    let imageBase64: string | undefined;
                    try {
                        const { saveScreenshot } = await import('@/utils/fileSaver');
                        await saveScreenshot(video, cameraName, '人形检测', '人形检测');

                        // 获取截图 base64 用于 TG 推送
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth || 640;
                        canvas.height = video.videoHeight || 480;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                            imageBase64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
                        }
                    } catch (e) {
                        console.error('[HumanDetector] Auto-capture failed:', e);
                    }

                    // 发送 Telegram 通知
                    if (window.electronAPI?.sendNotification) {
                        try {
                            const message = `🚨 人形侦测告警\n📷 ${cameraName}\n🕐 ${new Date().toLocaleString('zh-CN')}`;
                            await window.electronAPI.sendNotification(message, imageBase64);
                            console.log('[HumanDetector] TG notification sent');
                        } catch (notifyError) {
                            console.error('[HumanDetector] TG notification failed:', notifyError);
                        }
                    }
                }
            } else {
                setHumanDetected(false);
                setDetectionCount(0);
            }
        } catch (e) {
            console.debug('[HumanDetector] Detection error:', e);
        }
    }, [videoRef, cameraName, cameraId, confidenceThreshold, cooldownTime, onHumanDetected, isInRegion]);

    const startDetection = useCallback(async () => {
        if (globalIntervals.has(cameraId)) return;

        setIsModelLoading(true);
        const model = await loadGlobalModel();
        setIsModelLoading(false);

        if (!model) {
            toast.error('AI 模型未加载');
            return;
        }

        setIsDetecting(true);

        // 存储到全局 Map
        const intervalId = window.setInterval(detectHumans, checkInterval);
        globalIntervals.set(cameraId, intervalId);

        toast.success(`已开启人形侦测`, { description: cameraName });
    }, [cameraId, cameraName, detectHumans, checkInterval]);

    const stopDetection = useCallback(() => {
        const intervalId = globalIntervals.get(cameraId);
        if (intervalId) {
            clearInterval(intervalId);
            globalIntervals.delete(cameraId);
        }
        globalDetectionStates.delete(cameraId);

        setIsDetecting(false);
        setHumanDetected(false);
        setDetectionCount(0);

        toast.info(`已关闭人形侦测`, { description: cameraName });
    }, [cameraId, cameraName]);

    const toggleDetection = useCallback(() => {
        if (isDetecting) {
            stopDetection();
        } else {
            startDetection();
        }
    }, [isDetecting, startDetection, stopDetection]);

    // 组件卸载时，如果不是持久模式则停止检测
    useEffect(() => {
        return () => {
            if (!persistent) {
                stopDetection();
            }
        };
    }, [persistent, stopDetection]);

    return {
        isDetecting,
        humanDetected,
        detectionCount,
        isModelLoading,
        startDetection,
        stopDetection,
        toggleDetection,
    };
}
