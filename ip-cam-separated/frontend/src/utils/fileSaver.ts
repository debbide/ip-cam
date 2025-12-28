import { captureScreenshot } from '@/components/ScreenshotControl';

// 子文件夹类型
export type SaveSubfolder = '截图' | '录像' | '人形检测' | '移动侦测' | '';

/**
 * 保存截图到配置的路径（使用 Electron API）或触发下载（浏览器环境）
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

        // 检查是否在 Electron 环境中
        if (window.electronAPI) {
            // 将 blob 转换为 data URL
            const dataUrl = await blobToDataUrl(blob);
            const result = await window.electronAPI.saveFile(dataUrl, filename, subfolder);
            return result;
        } else {
            // 浏览器环境：触发下载
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            return { success: true };
        }
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
    if (window.electronAPI) {
        return await window.electronAPI.getSavePath();
    }
    return null;
}

/**
 * 选择保存目录
 */
export async function selectSaveDirectory(): Promise<string | null> {
    if (window.electronAPI) {
        return await window.electronAPI.selectDirectory();
    }
    return null;
}

/**
 * 打开保存目录
 */
export async function openSaveFolder(): Promise<boolean> {
    if (window.electronAPI) {
        return await window.electronAPI.openSaveFolder();
    }
    return false;
}
