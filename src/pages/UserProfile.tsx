import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { useBorrowings } from '../hooks/useBorrowings';
import { useFavorites } from '../hooks/useFavorites';

interface UserStats {
  totalBorrows: number;
  currentBorrows: number;
  historyBorrows: number;
  favoritesCount: number;
}

export const UserProfile = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { getUserBorrowings } = useBorrowings();
  const { getUserFavorites } = useFavorites();

  const [stats, setStats] = useState<UserStats>({
    totalBorrows: 0,
    currentBorrows: 0,
    historyBorrows: 0,
    favoritesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 编辑个人信息
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    address: '',
  });

  // 更改密码
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (userProfile) {
      setProfileForm({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
      });
    }
  }, [userProfile]);

  const loadStats = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 获取借阅统计
      const borrowings = await getUserBorrowings(user.id);
      const totalBorrows = borrowings.length;
      const currentBorrows = borrowings.filter(
        (b) => b.status === 'borrowed' || b.status === 'overdue'
      ).length;
      const historyBorrows = borrowings.filter((b) => b.status === 'returned').length;

      // 获取收藏统计
      const favorites = await getUserFavorites(user.id);
      const favoritesCount = favorites.length;

      setStats({
        totalBorrows,
        currentBorrows,
        historyBorrows,
        favoritesCount,
      });
    } catch (err) {
      console.error('加载统计数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [user, getUserBorrowings, getUserFavorites]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    setError(null);
    setSuccessMessage(null);

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: profileForm.full_name.trim(),
          phone: profileForm.phone.trim() || null,
          address: profileForm.address.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccessMessage('个人信息更新成功！');
      setIsEditingProfile(false);
      await refreshUserProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败，请重试');
    }
  };

  const handleChangePassword = async () => {
    if (!user || !passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError('请填写所有字段');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('新密码长度至少为6位');
      return;
    }

    setPasswordError(null);
    setError(null);
    setSuccessMessage(null);

    try {
      // 先验证当前密码
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email || '',
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        throw new Error('当前密码不正确');
      }

      // 更新密码
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) throw updateError;

      setSuccessMessage('密码修改成功！');
      setIsChangingPassword(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordError(null);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '密码修改失败，请重试');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading && !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>无法加载用户信息</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {/* 页面标题 */}
      <div className="mb-3">
        <h1 className="text-xl font-bold text-gray-100 mb-1">个人中心</h1>
        <p className="text-sm text-gray-300">管理您的账户信息和偏好设置</p>
      </div>

      {/* 成功/错误提示（不包括密码错误） */}
      {successMessage && (
        <div className="p-3 rounded-lg bg-green-100 text-green-800 border border-green-200 text-sm">
          {successMessage}
        </div>
      )}
      {error && !passwordError && (
        <div className="p-3 rounded-lg bg-red-100 text-red-800 border border-red-200 text-sm">
          {error}
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">总借阅数</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalBorrows}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">当前借阅</p>
              <p className="text-lg font-bold text-blue-600">{stats.currentBorrows}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">历史借阅</p>
              <p className="text-lg font-bold text-green-600">{stats.historyBorrows}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">我的收藏</p>
              <p className="text-lg font-bold text-purple-600">{stats.favoritesCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 账户信息 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-base font-bold text-gray-900">账户信息</h2>
        </div>
        <div className="p-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱地址</label>
              <p className="text-gray-900">{userProfile.email}</p>
              <p className="text-xs text-gray-500 mt-1">邮箱用于登录，不可修改</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户角色</label>
              <p className="text-gray-900">
                {userProfile.role === 'admin' ? (
                  <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-700 text-sm font-medium">
                    管理员
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-700 text-sm font-medium">
                    普通用户
                  </span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">注册时间</label>
              <p className="text-sm text-gray-900">{formatDate(userProfile.member_since)}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">借阅上限</label>
              <p className="text-sm text-gray-900">{userProfile.max_borrow_limit} 本</p>
            </div>
          </div>
        </div>
      </div>

      {/* 个人信息 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">个人信息</h2>
          {!isEditingProfile ? (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              编辑信息
            </button>
          ) : (
            <button
              onClick={() => {
                setIsEditingProfile(false);
                if (userProfile) {
                  setProfileForm({
                    full_name: userProfile.full_name || '',
                    phone: userProfile.phone || '',
                    address: userProfile.address || '',
                  });
                }
                setError(null);
              }}
              className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
          )}
        </div>
        <div className="p-4 space-y-2.5">
          {isEditingProfile ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">姓名</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入您的姓名"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">电话</label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入您的电话号码（可选）"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">地址</label>
                <textarea
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="请输入您的地址（可选）"
                />
              </div>

              <button
                onClick={handleUpdateProfile}
                className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存更改
              </button>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">姓名</label>
                <p className="text-sm text-gray-900">{userProfile.full_name || '未设置'}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">电话</label>
                <p className="text-sm text-gray-900">{userProfile.phone || '未设置'}</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-0.5">地址</label>
                <p className="text-sm text-gray-900">{userProfile.address || '未设置'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 更改密码 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">更改密码</h2>
            <p className="text-xs text-gray-500 mt-0.5">定期更改密码可以保护您的账户安全</p>
          </div>
          {!isChangingPassword ? (
            <button
              onClick={() => setIsChangingPassword(true)}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              更改密码
            </button>
          ) : (
            <button
              onClick={() => {
                setIsChangingPassword(false);
                setPasswordForm({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                });
                setPasswordError(null);
                setError(null);
              }}
              className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
          )}
        </div>
        {isChangingPassword && (
          <div className="p-4 space-y-2.5">
            {passwordError && (
              <div className="p-3 rounded-lg bg-red-100 text-red-800 border border-red-200 text-sm">
                {passwordError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">当前密码</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入当前密码"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">新密码</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入新密码（至少6位）"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">确认新密码</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请再次输入新密码"
              />
            </div>

            <button
              onClick={handleChangePassword}
              className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              更新密码
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

