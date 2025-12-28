import { useState, useEffect } from 'react';
import { useAuth, validatePassword, User } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, UserPlus, Trash2, Shield, Eye, EyeOff, Check, X } from 'lucide-react';
import { format } from 'date-fns';

export function UserManagement() {
  const { currentUser, getUsers, addUser, deleteUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 密码强度检查
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  useEffect(() => {
    setUsers(getUsers());
  }, [getUsers]);

  useEffect(() => {
    setPasswordChecks({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
    });
  }, [newPassword]);

  const refreshUsers = () => {
    setUsers(getUsers());
  };

  const handleAddUser = async () => {
    if (!newUsername || !newPassword) {
      toast.error('请填写用户名和密码');
      return;
    }

    setIsLoading(true);
    const result = await addUser(newUsername, newPassword, newIsAdmin);
    setIsLoading(false);

    if (result.success) {
      toast.success('用户添加成功');
      setIsAddDialogOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewIsAdmin(false);
      refreshUsers();
    } else {
      toast.error(result.error || '添加失败');
    }
  };

  const handleDeleteUser = (username: string) => {
    const result = deleteUser(username);
    if (result.success) {
      toast.success('用户已删除');
      refreshUsers();
    } else {
      toast.error(result.error || '删除失败');
    }
  };

  const PasswordCheck = ({ checked, label }: { checked: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-xs">
      {checked ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <X className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={checked ? 'text-green-500' : 'text-muted-foreground'}>{label}</span>
    </div>
  );

  // 非管理员不能访问
  if (!currentUser?.isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>只有管理员可以管理用户</p>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9" title="用户管理">
          <Users className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            用户管理
          </DialogTitle>
          <DialogDescription>
            管理系统用户账户，添加或删除用户
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 添加用户按钮 */}
          <div className="flex justify-end">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  添加用户
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加新用户</DialogTitle>
                  <DialogDescription>
                    创建一个新的用户账户
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-username">用户名</Label>
                    <Input
                      id="new-username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="至少3个字符"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">密码</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="请设置强密码"
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
                    <div className="grid grid-cols-2 gap-1 p-2 bg-muted rounded-lg">
                      <PasswordCheck checked={passwordChecks.length} label="至少8位" />
                      <PasswordCheck checked={passwordChecks.uppercase} label="大写字母" />
                      <PasswordCheck checked={passwordChecks.lowercase} label="小写字母" />
                      <PasswordCheck checked={passwordChecks.number} label="数字" />
                      <PasswordCheck checked={passwordChecks.special} label="特殊字符" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>管理员权限</Label>
                      <p className="text-xs text-muted-foreground">允许管理其他用户</p>
                    </div>
                    <Switch
                      checked={newIsAdmin}
                      onCheckedChange={setNewIsAdmin}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleAddUser} disabled={isLoading}>
                    {isLoading ? '添加中...' : '添加用户'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* 用户列表 */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.username}>
                    <TableCell className="font-medium">
                      {user.username}
                      {user.username === currentUser?.username && (
                        <Badge variant="outline" className="ml-2 text-xs">当前</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                          <Shield className="w-3 h-3 mr-1" />
                          管理员
                        </Badge>
                      ) : (
                        <Badge variant="secondary">普通用户</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.createdAt ? format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.username !== currentUser?.username && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除</AlertDialogTitle>
                              <AlertDialogDescription>
                                确定要删除用户 "{user.username}" 吗？此操作无法撤销。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.username)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
