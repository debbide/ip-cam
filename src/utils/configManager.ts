import { Camera } from '@/types/camera';
import { toast } from 'sonner';

const CONFIG_VERSION = '1.0';
const CAMERAS_STORAGE_KEY = 'nvr_cameras_config';

interface ConfigData {
  version: string;
  exportedAt: string;
  cameras: Camera[];
}

// 导出配置到 JSON 文件
export function exportConfig(cameras: Camera[]) {
  const config: ConfigData = {
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    cameras: cameras.map(cam => ({
      ...cam,
      // 清理运行时状态
      isRecording: false,
      recordingStartTime: undefined,
      status: 'offline' as const,
    })),
  };

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nvr-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success('配置已导出');
}

// 从 JSON 文件导入配置
export function importConfig(file: File): Promise<Camera[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const config: ConfigData = JSON.parse(content);
        
        // 验证配置格式
        if (!config.cameras || !Array.isArray(config.cameras)) {
          throw new Error('无效的配置文件格式');
        }

        // 验证每个摄像头的必要字段
        const validCameras = config.cameras.filter(cam => 
          cam.id && cam.name && cam.ipAddress
        ).map(cam => ({
          ...cam,
          status: 'connecting' as const,
          isRecording: false,
          lastSeen: new Date(),
        }));

        if (validCameras.length === 0) {
          throw new Error('配置文件中没有有效的摄像头');
        }

        toast.success(`成功导入 ${validCameras.length} 个摄像头配置`);
        resolve(validCameras);
      } catch (error) {
        const message = error instanceof Error ? error.message : '解析配置文件失败';
        toast.error(message);
        reject(new Error(message));
      }
    };

    reader.onerror = () => {
      toast.error('读取文件失败');
      reject(new Error('读取文件失败'));
    };

    reader.readAsText(file);
  });
}

// 保存配置到本地存储
export function saveConfigToStorage(cameras: Camera[]) {
  const config: ConfigData = {
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    cameras: cameras.map(cam => ({
      ...cam,
      isRecording: false,
      recordingStartTime: undefined,
    })),
  };
  localStorage.setItem(CAMERAS_STORAGE_KEY, JSON.stringify(config));
}

// 从本地存储加载配置
export function loadConfigFromStorage(): Camera[] | null {
  try {
    const stored = localStorage.getItem(CAMERAS_STORAGE_KEY);
    if (!stored) return null;

    const config: ConfigData = JSON.parse(stored);
    if (!config.cameras || !Array.isArray(config.cameras)) return null;

    return config.cameras.map(cam => ({
      ...cam,
      status: 'connecting' as const,
      isRecording: false,
      lastSeen: new Date(),
    }));
  } catch {
    return null;
  }
}
