// 检测区域定义（相对坐标 0-1）
export interface DetectionRegion {
  x: number;      // 左上角 x
  y: number;      // 左上角 y
  width: number;  // 宽度
  height: number; // 高度
}

export interface Camera {
  id: string;
  name: string;
  deviceName: string;
  ipAddress: string;
  port: number;
  username?: string;
  password?: string;
  mjpegPath: string;
  rtspPath?: string;
  status: 'online' | 'offline' | 'connecting';
  isRecording: boolean;
  recordingStartTime?: Date;
  hasAudio: boolean;
  hasPTZ: boolean;
  resolution: string;
  fps: number;
  bitrate: string;
  lastSeen: Date;
  streamUrl: string;
  mjpegUrl: string;
  hlsUrl?: string;
  webrtcUrl?: string;
  audioUrl: string;
  ptzUrl: string;
  streamType: 'mjpeg' | 'hls' | 'flv' | 'webrtc';
  // 人形检测配置
  humanDetectionEnabled?: boolean;
  humanDetectionRegion?: DetectionRegion;
  // 画面旋转角度
  rotation?: 0 | 90 | 180 | 270;
}

export interface CameraEvent {
  id: string;
  cameraId: string;
  cameraName: string;
  type: 'motion' | 'audio' | 'disconnect' | 'connect' | 'error';
  message: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error';
}

export interface SystemStats {
  totalCameras: number;
  onlineCameras: number;
  recordingCameras: number;
  totalStorage: string;
  usedStorage: string;
  cpuUsage: number;
  memoryUsage: number;
}
