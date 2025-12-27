import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, validatePassword } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Camera, Eye, EyeOff, Check, X } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login, register, hasUsers } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('login');
  const [rememberMe, setRememberMe] = useState(false);

  // 密码强度检查
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // 如果没有用户，默认显示注册
    if (!hasUsers) {
      setActiveTab('register');
    }
  }, [hasUsers]);

  useEffect(() => {
    setPasswordChecks({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    });
  }, [password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('请填写用户名和密码');
      return;
    }
    
    setIsLoading(true);
    
    // 模拟异步验证
    setTimeout(() => {
      login(username, password, rememberMe);
      setIsLoading(false);
      
      // 检查登录状态
      setTimeout(() => {
        const auth = localStorage.getItem('nvr_auth');
        if (auth !== 'true') {
          toast.error('用户名或密码错误');
        }
      }, 100);
    }, 500);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('请填写用户名和密码');
      return;
    }

    if (username.length < 3) {
      toast.error('用户名至少3个字符');
      return;
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('两次密码输入不一致');
      return;
    }

    setIsLoading(true);
    
    const result = register(username, password);
    
    setTimeout(() => {
      setIsLoading(false);
      if (result.success) {
        toast.success('注册成功！');
      } else {
        toast.error(result.error || '注册失败');
      }
    }, 500);
  };

  const PasswordCheck = ({ checked, label }: { checked: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {checked ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={checked ? 'text-green-500' : 'text-muted-foreground'}>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Camera className="h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold">NVR 监控系统</h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{hasUsers ? '登录' : '创建管理员账户'}</CardTitle>
            <CardDescription>
              {hasUsers ? '请输入您的登录凭证' : '首次使用，请创建管理员账户'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasUsers ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">登录</TabsTrigger>
                  <TabsTrigger value="register">注册</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username">用户名</Label>
                      <Input
                        id="login-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入用户名"
                        autoComplete="username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">密码</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="请输入密码"
                          autoComplete="current-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="remember-me" 
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                      />
                      <Label 
                        htmlFor="remember-me" 
                        className="text-sm font-normal cursor-pointer"
                      >
                        记住登录（30天）
                      </Label>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? '登录中...' : '登录'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-username">用户名</Label>
                      <Input
                        id="reg-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="至少3个字符"
                        autoComplete="username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">密码</Label>
                      <div className="relative">
                        <Input
                          id="reg-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="请设置强密码"
                          autoComplete="new-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="mt-2 space-y-1 p-3 bg-muted rounded-lg">
                        <PasswordCheck checked={passwordChecks.length} label="至少8个字符" />
                        <PasswordCheck checked={passwordChecks.uppercase} label="包含大写字母" />
                        <PasswordCheck checked={passwordChecks.lowercase} label="包含小写字母" />
                        <PasswordCheck checked={passwordChecks.number} label="包含数字" />
                        <PasswordCheck checked={passwordChecks.special} label="包含特殊字符" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-confirm">确认密码</Label>
                      <Input
                        id="reg-confirm"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="再次输入密码"
                        autoComplete="new-password"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? '注册中...' : '注册'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-username">管理员用户名</Label>
                  <Input
                    id="admin-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="至少3个字符"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">密码</Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请设置强密码"
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="mt-2 space-y-1 p-3 bg-muted rounded-lg">
                    <PasswordCheck checked={passwordChecks.length} label="至少8个字符" />
                    <PasswordCheck checked={passwordChecks.uppercase} label="包含大写字母" />
                    <PasswordCheck checked={passwordChecks.lowercase} label="包含小写字母" />
                    <PasswordCheck checked={passwordChecks.number} label="包含数字" />
                    <PasswordCheck checked={passwordChecks.special} label="包含特殊字符" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-confirm">确认密码</Label>
                  <Input
                    id="admin-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? '创建中...' : '创建管理员账户'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
