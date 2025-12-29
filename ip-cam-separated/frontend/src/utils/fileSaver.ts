import { captureScreenshot } from '@/components/ScreenshotControl';
import * as PlatformAPI from './platform';

// 子文件夹类型
export type SaveSubfolder = '截图' | '录像' | '人形检测' | '移动侦测' | '';

/**
 * 保存截图到配置的路径（使用原生 API）或触发下载（浏览器环境）
 * @param element 视频或图片元素
 * @param cameraName 摄像头名称
 * @param prefix 文件名前缀
 * @param subfolder 子文件夹名称（截图/录像/人形检测等）
 */
export async function saveScreenshot(
    element: HTMLImageElement | HTMLVideoElement | null,
    cameraName: string,
    prefix: string = '截图',
    subfolder: SaveSubfolder = '截图'
): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
        const blob = await captureScreenshot(element);
        if (!blob) {
            return { success: false, error: '截图失败' };
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${prefix}_${cameraName}_${timestamp}.jpg`;

        // 将 blob 转换为 data URL
        const dataUrl = await blobToDataUrl(blob);

        // 使用平台抽象层保存文件（支持 Electron 和 Capacitor）
        return await PlatformAPI.saveFile(dataUrl, filename, subfolder);
    } catch (error) {
        console.error('保存截图失败:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * 将 Blob 转换为 Data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * 获取当前保存路径
 */
export async function getSavePath(): Promise<string | null> {
    return await PlatformAPI.getSavePath();
}

/**
 * 选择保存目录（仅 Electron 支持）
 */
export async function selectSaveDirectory(): Promise<string | null> {
    return await PlatformAPI.selectDirectory();
}

/**
 * 打开保存目录
 */
export async function openSaveFolder(): Promise<boolean> {
    return await PlatformAPI.openSaveFolder();
}

