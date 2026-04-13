import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserThemePreference } from '../hooks/useUserThemePreference';
import { useLanguage } from '../contexts/LanguageContext';
import { BrandLogo } from './BrandLogo';
import { LanguageSwitcher } from './LanguageSwitcher';

export const Header = () => {
  const { user, signOut, userRole } = useAuth();
  const { isLightTheme, toggleTheme } = useUserThemePreference();
  const { language } = useLanguage();
  const textMap = {
    zh: {
      user: '用户',
      appTitle: '图书管理系统',
      appSubtitle: '管理和查看您的图书收藏',
      booksMgmt: '图书管理',
      borrowings: '借阅记录',
      switchToDark: '切换到深色主题',
      switchToLight: '切换到浅色主题',
      backToUser: '返回图书浏览',
      signOut: '退出',
      signOutConfirm: '确定要退出登录吗？',
      signOutFailed: '退出登录失败',
    },
    en: {
      user: 'User',
      appTitle: 'Library Management System',
      appSubtitle: 'Manage and view your library collection',
      booksMgmt: 'Books',
      borrowings: 'Borrowings',
      switchToDark: 'Switch to dark theme',
      switchToLight: 'Switch to light theme',
      backToUser: 'Back to user view',
      signOut: 'Sign out',
      signOutConfirm: 'Are you sure you want to sign out?',
      signOutFailed: 'Failed to sign out',
    },
    ja: {
      user: 'ユーザー',
      appTitle: '図書管理システム',
      appSubtitle: '図書コレクションの管理と閲覧',
      booksMgmt: '図書管理',
      borrowings: '貸出記録',
      switchToDark: 'ダークテーマへ切り替え',
      switchToLight: 'ライトテーマへ切り替え',
      backToUser: 'ユーザー画面へ戻る',
      signOut: 'ログアウト',
      signOutConfirm: 'ログアウトしますか？',
      signOutFailed: 'ログアウトに失敗しました',
    },
  } as const;
  const t = textMap[language];

  const getUserDisplayName = () => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    return user?.email?.split('@')[0] || t.user;
  };

  const handleSignOut = async () => {
    const shouldSignOut = window.confirm(t.signOutConfirm);
    if (!shouldSignOut) return;
    const { error } = await signOut();
    if (error) {
      alert(`${t.signOutFailed}: ${error.message}`);
    }
  };

  const navLinkClass = isLightTheme
    ? 'px-4 py-2 text-sm text-slate-700 hover:text-slate-900 hover:bg-amber-100/80 rounded-xl transition-colors border border-amber-200/80'
    : 'px-4 py-2 text-sm text-cyan-100/85 hover:text-white hover:bg-white/10 rounded-xl transition-colors border border-white/10';

  const secondaryBtnClass = isLightTheme
    ? 'px-4 py-2 text-sm rounded-xl text-slate-700 border border-amber-200 bg-white hover:bg-amber-50 transition-colors'
    : 'px-4 py-2 text-sm rounded-xl text-cyan-100 border border-cyan-300/30 bg-white/10 hover:bg-white/20 transition-colors';

  return (
    <header
      className={
        isLightTheme
          ? 'sticky top-0 z-20 border-b border-amber-200/70 bg-[#fffaf0]/95 backdrop-blur-xl shadow-[0_8px_32px_-16px_rgba(120,90,40,0.25)]'
          : 'sticky top-0 z-20 border-b border-white/10 bg-[#0b1024]/85 backdrop-blur-xl shadow-[0_12px_32px_-16px_rgba(0,0,0,0.8)]'
      }
    >
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <BrandLogo size="sm" className="ring-1 ring-cyan-400/35 flex-shrink-0" />
            <div>
              <h1 className={`text-2xl font-bold ${isLightTheme ? 'text-slate-800' : 'text-cyan-100'}`}>
                {t.appTitle}
              </h1>
              <p className={`text-sm ${isLightTheme ? 'text-slate-600' : 'text-cyan-100/70'}`}>
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {userRole === 'admin' && (
            <nav className="hidden md:flex items-center gap-2">
              <Link to="/admin/dashboard" className={navLinkClass}>
                {t.booksMgmt}
              </Link>
              <Link to="/admin/borrowings" className={navLinkClass}>
                {t.borrowings}
              </Link>
            </nav>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              title={isLightTheme ? t.switchToDark : t.switchToLight}
              aria-label={isLightTheme ? t.switchToDark : t.switchToLight}
              className={
                isLightTheme
                  ? 'h-9 w-9 flex items-center justify-center text-base rounded-lg transition-colors border text-slate-700 hover:text-slate-900 hover:bg-amber-100 border-amber-200'
                  : 'h-9 w-9 flex items-center justify-center text-base rounded-lg transition-colors border text-cyan-50/90 hover:text-white hover:bg-white/10 border-white/10'
              }
            >
              {isLightTheme ? '🌙' : '☀️'}
            </button>
            <LanguageSwitcher light={isLightTheme} />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-violet-600 rounded-full flex items-center justify-center shadow-md shadow-cyan-500/40">
                <span className="text-white text-sm font-medium">
                  {getUserDisplayName().charAt(0).toUpperCase()}
                </span>
              </div>
              <span className={`text-sm hidden sm:inline ${isLightTheme ? 'text-slate-800' : 'text-cyan-100/85'}`}>
                {getUserDisplayName()}
              </span>
            </div>
            {userRole === 'admin' && (
              <Link to="/user/home" className={secondaryBtnClass}>
                {t.backToUser}
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className={
                isLightTheme
                  ? 'px-4 py-2 text-sm rounded-xl text-rose-700 border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors'
                  : 'px-4 py-2 text-sm rounded-xl text-rose-100 border border-rose-300/30 bg-rose-500/15 hover:bg-rose-500/25 transition-colors'
              }
            >
              {t.signOut}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
