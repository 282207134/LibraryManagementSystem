import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { BrandLogo } from '../BrandLogo';
import { LanguageSwitcher } from '../LanguageSwitcher';

interface UserHeaderProps {
  isLightTheme: boolean;
  onToggleTheme: () => void;
}

export const UserHeader = ({ isLightTheme, onToggleTheme }: UserHeaderProps) => {
  const { user, userProfile, userRole, signOut } = useAuth();
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const textMap = {
    zh: {
      user: '用户',
      appName: '图书馆',
      home: '首页',
      browse: '图书浏览',
      borrowings: '我的借阅',
      favorites: '我的收藏',
      profile: '个人中心',
      searchPlaceholder: '搜索书名或作者...',
      search: '搜索',
      switchToDark: '切换到深色主题',
      switchToLight: '切换到浅色主题',
      admin: '管理员',
      adminPanel: '管理后台',
      signOut: '退出',
      signOutConfirm: '确定要退出登录吗？',
    },
    en: {
      user: 'User',
      appName: 'Library',
      home: 'Home',
      browse: 'Browse',
      borrowings: 'My Borrowings',
      favorites: 'My Favorites',
      profile: 'Profile',
      searchPlaceholder: 'Search title or author...',
      search: 'Search',
      switchToDark: 'Switch to dark theme',
      switchToLight: 'Switch to light theme',
      admin: 'Admin',
      adminPanel: 'Admin Panel',
      signOut: 'Sign out',
      signOutConfirm: 'Are you sure you want to sign out?',
    },
    ja: {
      user: 'ユーザー',
      appName: '図書館',
      home: 'ホーム',
      browse: '蔵書検索',
      borrowings: '貸出中',
      favorites: 'お気に入り',
      profile: 'プロフィール',
      searchPlaceholder: '書名または著者を検索...',
      search: '検索',
      switchToDark: 'ダークテーマへ切り替え',
      switchToLight: 'ライトテーマへ切り替え',
      admin: '管理者',
      adminPanel: '管理画面',
      signOut: 'ログアウト',
      signOutConfirm: 'ログアウトしますか？',
    },
  } as const;
  const t = textMap[language];

  const getUserDisplayName = () => {
    // 优先使用 userProfile 的 full_name，但确保不是邮箱格式
    if (userProfile?.full_name && !userProfile.full_name.includes('@')) {
      return userProfile.full_name;
    }
    // 其次使用 user_metadata 中的 name
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    // 最后使用邮箱的用户名部分
    return user?.email?.split('@')[0] || t.user;
  };

  const handleSignOut = async () => {
    const shouldSignOut = window.confirm(t.signOutConfirm);
    if (!shouldSignOut) return;
    await signOut();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/user/home?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <header className={`sticky top-0 z-20 backdrop-blur-xl transition-colors ${isLightTheme ? 'border-b border-amber-200/70 bg-[#fffaf0]/95 shadow-[0_8px_32px_-16px_rgba(120,90,40,0.25)]' : 'border-b border-white/10 bg-[#0b1024]/80 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.7)]'}`}>
      <div className="max-w-[72rem] mx-auto px-3 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-6 flex-shrink-0">
            <Link
              to="/user/dashboard"
              className={`flex items-center gap-2 text-lg font-bold drop-shadow hover:opacity-90 transition-opacity ${isLightTheme ? 'text-slate-800' : 'text-cyan-300'}`}
            >
              <BrandLogo size="sm" className="ring-1 ring-cyan-400/40" />
              <span>{t.appName}</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-4">
              <Link
                to="/user/dashboard"
                className={`transition-colors text-sm ${isLightTheme ? 'text-slate-700 hover:text-slate-900' : 'text-cyan-50/80 hover:text-cyan-300'}`}
              >
                {t.home}
              </Link>
              <Link
                to="/user/home"
                className={`transition-colors text-sm ${isLightTheme ? 'text-slate-700 hover:text-slate-900' : 'text-cyan-50/80 hover:text-cyan-300'}`}
              >
                {t.browse}
              </Link>
              <Link
                to="/user/my-borrowings"
                className={`transition-colors text-sm ${isLightTheme ? 'text-slate-700 hover:text-slate-900' : 'text-cyan-50/80 hover:text-cyan-300'}`}
              >
                {t.borrowings}
              </Link>
              <Link
                to="/user/my-favorites"
                className={`transition-colors text-sm ${isLightTheme ? 'text-slate-700 hover:text-slate-900' : 'text-cyan-50/80 hover:text-cyan-300'}`}
              >
                {t.favorites}
              </Link>
              <Link
                to="/user/profile"
                className={`transition-colors text-sm ${isLightTheme ? 'text-slate-700 hover:text-slate-900' : 'text-cyan-50/80 hover:text-cyan-300'}`}
              >
                {t.profile}
              </Link>
              {/* 搜索框 - 放在个人中心后面 */}
              <form onSubmit={handleSearch} className="ml-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className={`w-40 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 text-xs ${isLightTheme ? 'border border-amber-200 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-amber-400' : 'border border-cyan-300/30 bg-white/10 text-white placeholder:text-cyan-100/50 focus:ring-cyan-400'}`}
                />
                <button
                  type="submit"
                className={`px-3 py-1.5 text-white rounded-lg transition-colors text-xs whitespace-nowrap ${isLightTheme ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500'}`}
                >
                  {t.search}
                </button>
              </form>
            </nav>
          </div>
          
          <div className="flex items-center space-x-3 flex-shrink-0">
              <button
                type="button"
                onClick={onToggleTheme}
                title={isLightTheme ? t.switchToDark : t.switchToLight}
                aria-label={isLightTheme ? t.switchToDark : t.switchToLight}
                className={`h-9 w-9 flex items-center justify-center text-base rounded-lg transition-colors border ${isLightTheme ? 'text-slate-700 hover:text-slate-900 hover:bg-amber-100 border-amber-200' : 'text-cyan-50/90 hover:text-white hover:bg-white/10 border-white/10'}`}
              >
                {isLightTheme ? '🌙' : '☀️'}
              </button>
              <LanguageSwitcher light={isLightTheme} />
              <span className={isLightTheme ? 'text-slate-800' : 'text-cyan-50/90'}>
                👤 {getUserDisplayName()}
                {userRole === 'admin' && (
                  <span className={`ml-2 text-xs px-2 py-1 rounded border ${isLightTheme ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-rose-500/20 text-rose-200 border-rose-300/30'}`}>
                    {t.admin}
                  </span>
                )}
              </span>
              {userRole === 'admin' && (
                <Link
                  to="/admin/dashboard"
                  className={`transition-colors font-medium text-sm ${isLightTheme ? 'text-rose-700 hover:text-rose-800' : 'text-rose-300 hover:text-rose-200'}`}
                >
                  {t.adminPanel}
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className={`px-4 py-2 text-sm rounded-lg transition-colors border ${isLightTheme ? 'text-slate-700 hover:text-slate-900 hover:bg-amber-100 border-amber-200' : 'text-cyan-50/90 hover:text-white hover:bg-white/10 border-white/10'}`}
              >
                {t.signOut}
              </button>
            </div>
          </div>
        </div>
      </header>
  );
};
