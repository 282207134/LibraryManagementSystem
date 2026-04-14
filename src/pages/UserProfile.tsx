import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { useBorrowings } from '../hooks/useBorrowings';
import { useFavorites } from '../hooks/useFavorites';
import { useLanguage } from '../contexts/LanguageContext';

interface UserStats {
  totalBorrows: number;
  currentBorrows: number;
  historyBorrows: number;
  favoritesCount: number;
}

export const UserProfile = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { language } = useLanguage();
  const textMap = {
    zh: {
      profileUpdated: '个人信息更新成功！',
      updateFailed: '更新失败，请重试',
      fillAll: '请填写所有字段',
      passwordMismatch: '两次输入的新密码不一致',
      passwordShort: '新密码长度至少为6位',
      currentPasswordWrong: '当前密码不正确',
      passwordUpdatedJump: '密码修改成功！即将跳转到登录页...',
      passwordUpdatedRelogin: '密码修改成功，请重新登录。',
      passwordUpdateFailed: '密码修改失败，请重试',
      loading: '加载中...',
      loadUserFailed: '无法加载用户信息',
      title: '个人中心',
      subtitle: '管理您的账户信息和偏好设置',
      statTotal: '总借阅数',
      statCurrent: '当前借阅',
      statHistory: '历史借阅',
      statFavorites: '我的收藏',
      accountInfo: '账户信息',
      email: '邮箱地址',
      emailReadonly: '邮箱用于登录，不可修改',
      role: '用户角色',
      admin: '管理员',
      user: '普通用户',
      memberSince: '注册时间',
      borrowLimit: '借阅上限',
      bookUnit: '本',
      personalInfo: '个人信息',
      editInfo: '编辑信息',
      cancel: '取消',
      name: '姓名',
      phone: '电话',
      address: '地址',
      namePlaceholder: '请输入您的姓名',
      phonePlaceholder: '请输入您的电话号码（可选）',
      addressPlaceholder: '请输入您的地址（可选）',
      saveChanges: '保存更改',
      notSet: '未设置',
      changePassword: '更改密码',
      passwordTip: '定期更改密码可以保护您的账户安全',
      currentPassword: '当前密码',
      newPassword: '新密码',
      confirmNewPassword: '确认新密码',
      currentPasswordPlaceholder: '请输入当前密码',
      newPasswordPlaceholder: '请输入新密码（至少6位）',
      confirmNewPasswordPlaceholder: '请再次输入新密码',
      updatePassword: '更新密码',
    },
    en: {
      profileUpdated: 'Profile updated successfully!',
      updateFailed: 'Update failed, please try again',
      fillAll: 'Please fill in all fields',
      passwordMismatch: 'New passwords do not match',
      passwordShort: 'New password must be at least 6 characters',
      currentPasswordWrong: 'Current password is incorrect',
      passwordUpdatedJump: 'Password updated! Redirecting to login...',
      passwordUpdatedRelogin: 'Password updated, please sign in again.',
      passwordUpdateFailed: 'Password update failed, please try again',
      loading: 'Loading...',
      loadUserFailed: 'Unable to load user information',
      title: 'Profile',
      subtitle: 'Manage your account information and preferences',
      statTotal: 'Total Borrows',
      statCurrent: 'Current Borrows',
      statHistory: 'Borrow History',
      statFavorites: 'Favorites',
      accountInfo: 'Account Info',
      email: 'Email',
      emailReadonly: 'Email is used for login and cannot be changed',
      role: 'Role',
      admin: 'Admin',
      user: 'User',
      memberSince: 'Member Since',
      borrowLimit: 'Borrow Limit',
      bookUnit: '',
      personalInfo: 'Personal Info',
      editInfo: 'Edit Info',
      cancel: 'Cancel',
      name: 'Name',
      phone: 'Phone',
      address: 'Address',
      namePlaceholder: 'Enter your name',
      phonePlaceholder: 'Enter your phone (optional)',
      addressPlaceholder: 'Enter your address (optional)',
      saveChanges: 'Save Changes',
      notSet: 'Not set',
      changePassword: 'Change Password',
      passwordTip: 'Changing your password regularly keeps your account secure',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmNewPassword: 'Confirm New Password',
      currentPasswordPlaceholder: 'Enter current password',
      newPasswordPlaceholder: 'Enter new password (at least 6 characters)',
      confirmNewPasswordPlaceholder: 'Enter new password again',
      updatePassword: 'Update Password',
    },
    ja: {
      profileUpdated: 'プロフィールを更新しました！',
      updateFailed: '更新に失敗しました。再試行してください',
      fillAll: 'すべての項目を入力してください',
      passwordMismatch: '新しいパスワードが一致しません',
      passwordShort: '新しいパスワードは6文字以上必要です',
      currentPasswordWrong: '現在のパスワードが正しくありません',
      passwordUpdatedJump: 'パスワードを更新しました。ログイン画面へ移動します...',
      passwordUpdatedRelogin: 'パスワードを更新しました。再ログインしてください。',
      passwordUpdateFailed: 'パスワード更新に失敗しました。再試行してください',
      loading: '読み込み中...',
      loadUserFailed: 'ユーザー情報を読み込めませんでした',
      title: 'プロフィール',
      subtitle: 'アカウント情報と設定を管理します',
      statTotal: '総貸出数',
      statCurrent: '現在の貸出',
      statHistory: '貸出履歴',
      statFavorites: 'お気に入り',
      accountInfo: 'アカウント情報',
      email: 'メールアドレス',
      emailReadonly: 'ログイン用メールのため変更できません',
      role: 'ユーザー役割',
      admin: '管理者',
      user: '一般ユーザー',
      memberSince: '登録日',
      borrowLimit: '貸出上限',
      bookUnit: '冊',
      personalInfo: '個人情報',
      editInfo: '編集',
      cancel: 'キャンセル',
      name: '氏名',
      phone: '電話番号',
      address: '住所',
      namePlaceholder: '氏名を入力してください',
      phonePlaceholder: '電話番号を入力（任意）',
      addressPlaceholder: '住所を入力（任意）',
      saveChanges: '保存',
      notSet: '未設定',
      changePassword: 'パスワード変更',
      passwordTip: '定期的なパスワード変更でアカウントを保護できます',
      currentPassword: '現在のパスワード',
      newPassword: '新しいパスワード',
      confirmNewPassword: '新しいパスワード確認',
      currentPasswordPlaceholder: '現在のパスワードを入力',
      newPasswordPlaceholder: '新しいパスワードを入力（6文字以上）',
      confirmNewPasswordPlaceholder: '新しいパスワードを再入力',
      updatePassword: 'パスワード更新',
    },
  } as const;
  const t = textMap[language];
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

      setSuccessMessage(t.profileUpdated);
      setIsEditingProfile(false);
      await refreshUserProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.updateFailed);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError(t.fillAll);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t.passwordMismatch);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError(t.passwordShort);
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
        throw new Error(t.currentPasswordWrong);
      }

      // 更新密码
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) throw updateError;

      setSuccessMessage(t.passwordUpdatedJump);
      // 会话可能被 Supabase 立即刷新/失效，使用跨页面通知兜底。
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('auth_notice', t.passwordUpdatedRelogin);
      }
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordError(null);
      window.setTimeout(async () => {
        setIsChangingPassword(false);
        await supabase.auth.signOut();
      }, 1500);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t.passwordUpdateFailed);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading && !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">{t.loading}</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>{t.loadUserFailed}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {/* 页面标题 */}
      <div className="mb-3">
        <h1 className="text-xl font-bold text-gray-100 mb-1">{t.title}</h1>
        <p className="text-sm text-gray-300">{t.subtitle}</p>
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
              <p className="text-xs text-gray-600 mb-0.5">{t.statTotal}</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalBorrows}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">{t.statCurrent}</p>
              <p className="text-lg font-bold text-blue-600">{stats.currentBorrows}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">{t.statHistory}</p>
              <p className="text-lg font-bold text-green-600">{stats.historyBorrows}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">{t.statFavorites}</p>
              <p className="text-lg font-bold text-purple-600">{stats.favoritesCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 账户信息 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-base font-bold text-gray-900">{t.accountInfo}</h2>
        </div>
        <div className="p-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label>
              <p className="text-gray-900">{userProfile.email}</p>
              <p className="text-xs text-gray-500 mt-1">{t.emailReadonly}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.role}</label>
              <p className="text-gray-900">
                {userProfile.role === 'admin' ? (
                  <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-700 text-sm font-medium">
                    {t.admin}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-700 text-sm font-medium">
                    {t.user}
                  </span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.memberSince}</label>
              <p className="text-sm text-gray-900">{formatDate(userProfile.member_since)}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.borrowLimit}</label>
              <p className="text-sm text-gray-900">{userProfile.max_borrow_limit} {t.bookUnit}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 个人信息 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">{t.personalInfo}</h2>
          {!isEditingProfile ? (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t.editInfo}
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
              {t.cancel}
            </button>
          )}
        </div>
        <div className="p-4 space-y-2.5">
          {isEditingProfile ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.name}</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t.namePlaceholder}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.phone}</label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t.phonePlaceholder}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.address}</label>
                <textarea
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder={t.addressPlaceholder}
                />
              </div>

              <button
                onClick={handleUpdateProfile}
                className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t.saveChanges}
              </button>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.name}</label>
                <p className="text-sm text-gray-900">{userProfile.full_name || t.notSet}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.phone}</label>
                <p className="text-sm text-gray-900">{userProfile.phone || t.notSet}</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.address}</label>
                <p className="text-sm text-gray-900">{userProfile.address || t.notSet}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 更改密码 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">{t.changePassword}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t.passwordTip}</p>
          </div>
          {!isChangingPassword ? (
            <button
              onClick={() => setIsChangingPassword(true)}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t.changePassword}
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
              {t.cancel}
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
              <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.currentPassword}</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t.currentPasswordPlaceholder}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.newPassword}</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t.newPasswordPlaceholder}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">{t.confirmNewPassword}</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t.confirmNewPasswordPlaceholder}
              />
            </div>

            <button
              onClick={handleChangePassword}
              className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t.updatePassword}
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

