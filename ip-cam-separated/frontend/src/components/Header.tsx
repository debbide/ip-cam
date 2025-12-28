import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Video,
  Bell,
  Grid3X3,
  LayoutGrid,
  Search,
  Menu,
  X,
  PlayCircle,
  User,
  Activity,
  Trash2,
  LogOut
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MotionEvent } from '@/components/MotionEventLog';
import { ServerConfigDialog } from '@/components/ServerConfigDialog';
import { usePermission, useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  alertCount?: number;
  motionEvents?: MotionEvent[];
  onClearEvents?: () => void;
  onMenuClick?: () => void;
  isMobileMenuOpen?: boolean;
  configManager?: React.ReactNode;
  onPlaybackClick?: () => void;
}

export function Header({ alertCount = 0, motionEvents = [], onClearEvents, onMenuClick, isMobileMenuOpen, configManager, onPlaybackClick }: HeaderProps) {
  const { isAdmin } = usePermission();
  const { currentUser, logout } = useAuth();

  return (
    <header className="h-14 md:h-16 bg-card border-b border-border px-3 md:px-6 flex items-center justify-between gap-3">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0"
        onClick={onMenuClick}
      >
        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Logo & Title */}
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center glow-primary shrink-0">
            <Video className="w-4 h-4 md:w-6 md:h-6 text-primary" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base md:text-lg font-bold text-glow-primary leading-tight">NVR 监控中心</h1>
            <p className="text-[10px] md:text-xs text-muted-foreground font-mono">IP Webcam Manager</p>
          </div>
        </div>
      </div>

      {/* Search - Hidden on mobile */}
      <div className="hidden lg:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索设备或事件..."
            className="pl-10 bg-secondary/50 border-border focus:border-primary"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Server Config Button - Admin only */}
        {isAdmin && <ServerConfigDialog />}

        {/* Mobile Search Button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 md:h-9 md:w-9">
              <Search className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="top" className="h-auto">
            <div className="pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索设备或事件..."
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Notification Button with Popover */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-9 md:w-9">
              <Bell className="w-4 h-4 md:w-5 md:h-5" />
              {alertCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 md:h-5 min-w-4 md:min-w-5 flex items-center justify-center p-0 text-[10px] md:text-xs"
                >
                  {alertCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-96 p-0">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">通知记录</h3>
                <p className="text-sm text-muted-foreground">最近的检测事件</p>
              </div>
              {motionEvents.length > 0 && onClearEvents && (
                <Button variant="ghost" size="sm" onClick={onClearEvents} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4 mr-1" />
                  清空
                </Button>
              )}
            </div>
            <div className="max-h-[calc(100vh-120px)] overflow-auto">
              {motionEvents.length > 0 ? (
                <div className="divide-y">
                  {motionEvents.slice(0, 50).map((event) => (
                    <div key={event.id} className="p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${event.id.startsWith('human-') ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                          }`}>
                          {event.id.startsWith('human-') ? <User className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{event.cameraName}</span>
                            <Badge variant={event.id.startsWith('human-') ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                              {event.id.startsWith('human-') ? '人形' : '移动'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(event.timestamp).toLocaleString('zh-CN')}
                          </p>
                          {event.motionLevel && (
                            <p className="text-xs text-muted-foreground">
                              置信度: {(event.motionLevel * 100).toFixed(0)}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">暂无通知</p>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <div className="hidden md:flex items-center bg-secondary/50 rounded-lg p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>

        {configManager}

        {/* Playback Button */}
        {onPlaybackClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9"
            onClick={onPlaybackClick}
            title="录像回放"
          >
            <PlayCircle className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        )}

        {/* User Info & Logout */}
        {currentUser && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
            <span className="hidden md:inline text-sm text-muted-foreground">
              {currentUser.username}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:h-9 md:w-9"
              onClick={logout}
              title="退出登录"
            >
              <LogOut className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
