import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HardDrive, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

export function StorageSettings() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        usedBytes: 0,
        path: '',
        quotaGB: 50,
        enabled: false
    });
    const [hasChanges, setHasChanges] = useState(false);

    const loadStats = async () => {
        if (!window.electronAPI) return;
        try {
            setLoading(true);
            const result = await window.electronAPI.getStorageStats();
            setStats(result);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to load storage stats:', error);
            toast.error('无法加载存储信息');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const handleSave = async () => {
        if (!window.electronAPI) return;
        try {
            await window.electronAPI.updateStorageSettings({
                enabled: stats.enabled,
                maxSizeGB: stats.quotaGB
            });
            toast.success('存储设置已保存');
            setHasChanges(false);
            loadStats(); // Refresh to see any immediate cleanup effects
        } catch (error) {
            toast.error('保存失败');
        }
    };

    const usedGB = stats.usedBytes / 1024 / 1024 / 1024;
    const usagePercent = stats.enabled ? Math.min((usedGB / stats.quotaGB) * 100, 100) : 0;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HardDrive className="w-5 h-5" />
                        存储空间管理
                    </CardTitle>
                    <CardDescription>
                        管理录像文件的存储策略，防止磁盘空间耗尽。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Enable Switch */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">启用循环录像</Label>
                            <p className="text-sm text-muted-foreground">
                                当存储空间超过限制时，自动删除最早的录像文件。
                            </p>
                        </div>
                        <Switch
                            checked={stats.enabled}
                            onCheckedChange={(checked) => {
                                setStats(prev => ({ ...prev, enabled: checked }));
                                setHasChanges(true);
                            }}
                        />
                    </div>

                    {/* Usage Visualization */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>当前使用: {usedGB.toFixed(2)} GB</span>
                            <span>限制: {stats.quotaGB} GB</span>
                        </div>
                        <Progress value={usagePercent} className={usagePercent > 90 ? "bg-destructive/20" : ""} />
                        <p className="text-xs text-muted-foreground text-right">
                            保存路径: {stats.path}
                        </p>
                    </div>

                    {/* Quota Slider */}
                    <div className="space-y-4 pt-4">
                        <div className="flex justify-between items-center">
                            <Label>最大存储配额 (GB)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min={1}
                                    max={10000}
                                    value={stats.quotaGB}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 1;
                                        const clampedVal = Math.max(1, Math.min(10000, val));
                                        setStats(prev => ({ ...prev, quotaGB: clampedVal }));
                                        setHasChanges(true);
                                    }}
                                    disabled={!stats.enabled}
                                    className="w-24 h-8 text-center font-mono"
                                />
                                <span className="text-sm text-muted-foreground">GB</span>
                            </div>
                        </div>
                        <Slider
                            value={[Math.min(stats.quotaGB, 1000)]}
                            min={1}
                            max={1000}
                            step={1}
                            disabled={!stats.enabled}
                            onValueChange={(val) => {
                                setStats(prev => ({ ...prev, quotaGB: val[0] }));
                                setHasChanges(true);
                            }}
                        />
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            建议预留至少 10GB 空间。当使用量达到 90% 时将触发清理。输入框支持输入超过 1000GB。
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={loadStats} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            刷新状态
                        </Button>
                        <Button onClick={handleSave} disabled={!hasChanges || loading}>
                            保存设置
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
