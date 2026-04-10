import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserThemePreference } from '../hooks/useUserThemePreference';
import { BrandLogo } from './BrandLogo';

export const Header = () => {
  const { user, signOut, userRole } = useAuth();
  const { isLightTheme, toggleTheme } = useUserThemePreference();

  const getUserDisplayName = () => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    return user?.email?.split('@')[0] || '用户';
  };

  const handleSignOut = async () => {
    const shouldSignOut = window.confirm('确定要退出登录吗？');
    if (!shouldSignOut) return;
    const { error } = await signOut();
    if (error) {
      alert(`退出登录失败：${error.message}`);
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
                图书管理系统
              </h1>
              <p className={`text-sm ${isLightTheme ? 'text-slate-600' : 'text-cyan-100/70'}`}>
                管理和查看您的图书收藏
              </p>
            </div>
          </div>

          {userRole === 'admin' && (
            <nav className="hidden md:flex items-center gap-2">
              <Link to="/admin/dashboard" className={navLinkClass}>
                图书管理
              </Link>
              <Link to="/admin/borrowings" className={navLinkClass}>
                借阅记录
              </Link>
            </nav>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              title={isLightTheme ? '切换到深色主题' : '切换到浅色主题'}
              aria-label={isLightTheme ? '切换到深色主题' : '切换到浅色主题'}
              className={
                isLightTheme
                  ? 'h-9 w-9 flex items-center justify-center text-base rounded-lg transition-colors border text-slate-700 hover:text-slate-900 hover:bg-amber-100 border-amber-200'
                  : 'h-9 w-9 flex items-center justify-center text-base rounded-lg transition-colors border text-cyan-50/90 hover:text-white hover:bg-white/10 border-white/10'
              }
            >
              {isLightTheme ? '🌙' : '☀️'}
            </button>
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
                返回图书浏览
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
              退出
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
