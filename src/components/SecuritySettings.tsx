import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Shield, ShieldAlert, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';

interface SecuritySettingsProps {
    compact?: boolean;
}

export function SecuritySettings({ compact = false }: SecuritySettingsProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [settings, setSettings] = useState({
        enabled: false,
        password: ''
    });

    const { token, checkAuthRequirement } = useAuth();
    const { fetchWithAuth } = useApi();

    const loadSettings = async () => {
        setLoading(true);
        try {
            // 首先检查服务器是否需要认证
            await fetchWithAuth('/api/server-info');

            // 获取详细设置
            const response = await fetchWithAuth('/api/settings');

            if (response.ok) {
                const data = await response.json();
                if (data && data.auth) {
                    setSettings({
                        enabled: data.auth.enabled,
                        password: data.auth.password || ''
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load security settings:', error);
            // 如果是因为未登录导致的失败（401），则保持默认状态
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadSettings();
        }
    }, [open]);

    const handleSave = async () => {
        if (settings.enabled && !settings.password) {
            toast.error('开启认证时必须设置密码');
            return;
        }

        setSaving(true);
        try {
            const response = await fetchWithAuth('/api/settings', {
                method: 'POST',
                body: JSON.stringify({
                    auth: {
                        enabled: settings.enabled,
                        password: settings.password
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save settings');
            }

            toast.success('安全设置已更新');

            // 重新检查认证需求，可能会触发登出或状态更新
            await checkAuthRequirement();

            setOpen(false);
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast.error('保存设置失败');
        } finally {
            setSaving(false);
        }
    };

    const content = (
        <div className="space-y-6 mt-4">
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                        <div className="space-y-0.5">
                            <label className="text-base font-medium">启用身份验证</label>
                            <p className="text-sm text-muted-foreground">
                                开启后，访问后台管理和视频流需要登录
                            </p>
                        </div>
                        <Switch
                            checked={settings.enabled}
                            onCheckedChange={(checked) => setSettings(s => ({ ...s, enabled: checked }))}
                        />
                    </div>

                    {settings.enabled && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <label className="text-sm font-medium">管理员密码</label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={settings.password}
                                    onChange={(e) => setSettings(s => ({ ...s, password: e.target.value }))}
                                    placeholder="设置管理员密码"
                                    className="pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                建议使用强密码以确保安全
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            保存更改
                        </Button>
                    </div>
                </>
            )}
        </div>
    );

    if (compact) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                        {settings.enabled ? (
                            <ShieldCheck className="w-5 h-5 text-green-500" />
                        ) : (
                            <ShieldAlert className="w-5 h-5 text-yellow-500" />
                        )}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            安全验证
                        </DialogTitle>
                        <DialogDescription>
                            配置后端服务的访问权限和密码
                        </DialogDescription>
                    </DialogHeader>
                    {content}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    {settings.enabled ? (
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                    ) : (
                        <ShieldAlert className="w-4 h-4 text-yellow-500" />
                    )}
                    安全设置
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        安全验证
                    </DialogTitle>
                    <DialogDescription>
                        配置后端服务的访问权限和密码
                    </DialogDescription>
                </DialogHeader>
                {content}
            </DialogContent>
        </Dialog>
    );
}
