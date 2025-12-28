import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Send, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationConfig {
    enabled: boolean;
    type: 'telegram' | 'dingtalk' | 'wecom' | 'webhook';
    webhookUrl: string;
    telegramBotToken: string;
    telegramChatId: string;
    wecomWebhookUrl: string; // 企业微信机器人 Webhook
}

export function NotificationSettings() {
    const [config, setConfig] = useState<NotificationConfig>({
        enabled: false,
        type: 'webhook',
        webhookUrl: '',
        telegramBotToken: '',
        telegramChatId: '',
        wecomWebhookUrl: ''
    });
    const [testing, setTesting] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await (window.electronAPI as any).getNotificationConfig?.();
            if (result) {
                setConfig(result);
            }
        } catch (error) {
            console.error('Failed to load notification config:', error);
        }
    };

    const handleSave = async () => {
        if (!window.electronAPI) return;
        try {
            await (window.electronAPI as any).updateNotificationConfig?.(config);
            toast.success('通知设置已保存');
            setHasChanges(false);
        } catch (error) {
            toast.error('保存失败');
        }
    };

    const handleTest = async () => {
        if (!window.electronAPI) return;
        setTesting(true);
        try {
            const result = await (window.electronAPI as any).sendTestNotification?.();
            if (result?.success) {
                toast.success('测试通知发送成功！', {
                    icon: <CheckCircle2 className="w-4 h-4 text-green-500" />
                });
            } else {
                toast.error(`发送失败: ${result?.error || '未知错误'}`, {
                    icon: <XCircle className="w-4 h-4 text-red-500" />
                });
            }
        } catch (error: any) {
            toast.error(`发送失败: ${error.message}`);
        } finally {
            setTesting(false);
        }
    };

    const updateConfig = (partial: Partial<NotificationConfig>) => {
        setConfig(prev => ({ ...prev, ...partial }));
        setHasChanges(true);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5" />
                        报警推送设置
                    </CardTitle>
                    <CardDescription>
                        当检测到人形时，将截图发送到您的手机或群组。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Enable Switch */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">启用报警推送</Label>
                            <p className="text-sm text-muted-foreground">
                                检测到人形时自动发送通知。
                            </p>
                        </div>
                        <Switch
                            checked={config.enabled}
                            onCheckedChange={(checked) => updateConfig({ enabled: checked })}
                        />
                    </div>

                    {/* Notification Type */}
                    <div className="space-y-2">
                        <Label>推送方式</Label>
                        <Select
                            value={config.type}
                            onValueChange={(value: NotificationConfig['type']) => updateConfig({ type: value })}
                            disabled={!config.enabled}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="选择推送方式" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="telegram">Telegram</SelectItem>
                                <SelectItem value="wecom">企业微信机器人</SelectItem>
                                <SelectItem value="dingtalk">钉钉机器人</SelectItem>
                                <SelectItem value="webhook">通用 Webhook</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Telegram Config */}
                    {config.type === 'telegram' && (
                        <div className="space-y-4 p-4 bg-secondary/50 rounded-lg">
                            <div className="space-y-2">
                                <Label>Bot Token</Label>
                                <Input
                                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                    value={config.telegramBotToken}
                                    onChange={(e) => updateConfig({ telegramBotToken: e.target.value })}
                                    disabled={!config.enabled}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Chat ID</Label>
                                <Input
                                    placeholder="-1001234567890 或 @channelname"
                                    value={config.telegramChatId}
                                    onChange={(e) => updateConfig({ telegramChatId: e.target.value })}
                                    disabled={!config.enabled}
                                />
                            </div>
                        </div>
                    )}

                    {/* WeCom (企业微信) Config */}
                    {config.type === 'wecom' && (
                        <div className="space-y-4 p-4 bg-secondary/50 rounded-lg">
                            <div className="space-y-2">
                                <Label>Webhook URL</Label>
                                <Input
                                    placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                                    value={config.wecomWebhookUrl}
                                    onChange={(e) => updateConfig({ wecomWebhookUrl: e.target.value })}
                                    disabled={!config.enabled}
                                />
                                <p className="text-xs text-muted-foreground">
                                    从企业微信群机器人设置中获取。支持发送图片消息。
                                </p>
                            </div>
                        </div>
                    )}

                    {/* DingTalk Config */}
                    {config.type === 'dingtalk' && (
                        <div className="space-y-4 p-4 bg-secondary/50 rounded-lg">
                            <div className="space-y-2">
                                <Label>Webhook URL</Label>
                                <Input
                                    placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                                    value={config.webhookUrl}
                                    onChange={(e) => updateConfig({ webhookUrl: e.target.value })}
                                    disabled={!config.enabled}
                                />
                                <p className="text-xs text-muted-foreground">
                                    从钉钉群机器人设置中获取。
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Generic Webhook Config */}
                    {config.type === 'webhook' && (
                        <div className="space-y-4 p-4 bg-secondary/50 rounded-lg">
                            <div className="space-y-2">
                                <Label>Webhook URL</Label>
                                <Input
                                    placeholder="https://your-server.com/webhook"
                                    value={config.webhookUrl}
                                    onChange={(e) => updateConfig({ webhookUrl: e.target.value })}
                                    disabled={!config.enabled}
                                />
                                <p className="text-xs text-muted-foreground">
                                    将以 POST 方式发送 JSON 数据。
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            variant="outline"
                            onClick={handleTest}
                            disabled={!config.enabled || testing}
                        >
                            <Send className={`w-4 h-4 mr-2 ${testing ? 'animate-pulse' : ''}`} />
                            发送测试消息
                        </Button>
                        <Button onClick={handleSave} disabled={!hasChanges}>
                            保存设置
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
