import { SystemStats as SystemStatsType } from '@/types/camera';
import { Progress } from '@/components/ui/progress';
import { 
  Camera, 
  HardDrive, 
  Cpu, 
  MemoryStick,
  Circle,
  Wifi
} from 'lucide-react';

interface SystemStatsProps {
  stats: SystemStatsType;
}

export function SystemStats({ stats }: SystemStatsProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-3 md:p-4">
      <h3 className="font-semibold mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
        <Cpu className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        系统状态
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {/* Camera Stats */}
        <div className="bg-secondary/30 rounded-lg p-2 md:p-3">
          <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
            <Camera className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
            <span className="text-[10px] md:text-xs text-muted-foreground">摄像头</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl md:text-2xl font-bold text-primary">{stats.onlineCameras}</span>
            <span className="text-xs md:text-sm text-muted-foreground">/ {stats.totalCameras}</span>
          </div>
          <div className="flex items-center gap-1 md:gap-1.5 mt-0.5 md:mt-1">
            <Wifi className="w-2.5 h-2.5 md:w-3 md:h-3 text-success" />
            <span className="text-[10px] md:text-xs text-muted-foreground">在线</span>
          </div>
        </div>

        {/* Recording Stats */}
        <div className="bg-secondary/30 rounded-lg p-2 md:p-3">
          <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
            <Circle className="w-3.5 h-3.5 md:w-4 md:h-4 text-destructive fill-destructive" />
            <span className="text-[10px] md:text-xs text-muted-foreground">录制中</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl md:text-2xl font-bold text-destructive">{stats.recordingCameras}</span>
            <span className="text-xs md:text-sm text-muted-foreground">台</span>
          </div>
          <div className="h-1 md:h-1.5 bg-muted rounded-full mt-1.5 md:mt-2 overflow-hidden">
            <div 
              className="h-full bg-destructive glow-destructive transition-all"
              style={{ width: `${(stats.recordingCameras / stats.totalCameras) * 100}%` }}
            />
          </div>
        </div>

        {/* Storage */}
        <div className="bg-secondary/30 rounded-lg p-2 md:p-3">
          <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
            <HardDrive className="w-3.5 h-3.5 md:w-4 md:h-4 text-warning" />
            <span className="text-[10px] md:text-xs text-muted-foreground">存储空间</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg md:text-2xl font-bold text-warning">{stats.usedStorage}</span>
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
            共 {stats.totalStorage}
          </p>
          <Progress 
            value={42} 
            className="h-1 md:h-1.5 mt-1.5 md:mt-2 bg-muted [&>div]:bg-warning" 
          />
        </div>

        {/* CPU & Memory */}
        <div className="bg-secondary/30 rounded-lg p-2 md:p-3">
          <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
            <MemoryStick className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent" />
            <span className="text-[10px] md:text-xs text-muted-foreground">系统资源</span>
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <div>
              <div className="flex justify-between text-[10px] md:text-xs mb-0.5 md:mb-1">
                <span className="text-muted-foreground">CPU</span>
                <span className="font-mono text-foreground">{stats.cpuUsage}%</span>
              </div>
              <Progress 
                value={stats.cpuUsage} 
                className="h-0.5 md:h-1 bg-muted [&>div]:bg-primary" 
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] md:text-xs mb-0.5 md:mb-1">
                <span className="text-muted-foreground">内存</span>
                <span className="font-mono text-foreground">{stats.memoryUsage}%</span>
              </div>
              <Progress 
                value={stats.memoryUsage} 
                className="h-0.5 md:h-1 bg-muted [&>div]:bg-accent" 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
