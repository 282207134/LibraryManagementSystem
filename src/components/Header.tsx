import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const Header = () => {
  const { user, signOut, userRole } = useAuth();

  const getUserDisplayName = () => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    return user?.email?.split('@')[0] || '用户';
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      alert(`退出登录失败：${error.message}`);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1024]/85 backdrop-blur-xl shadow-[0_12px_32px_-16px_rgba(0,0,0,0.8)]">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-cyan-100">图书管理系统</h1>
              <p className="text-sm text-cyan-100/70">管理和查看您的图书收藏</p>
            </div>
          </div>

          {/* 管理员导航菜单 */}
          {userRole === 'admin' && (
            <nav className="hidden md:flex items-center gap-2">
              <Link
                to="/admin/dashboard"
                className="px-4 py-2 text-sm text-cyan-100/85 hover:text-white hover:bg-white/10 rounded-xl transition-colors border border-white/10"
              >
                图书管理
              </Link>
              <Link
                to="/admin/borrowings"
                className="px-4 py-2 text-sm text-cyan-100/85 hover:text-white hover:bg-white/10 rounded-xl transition-colors border border-white/10"
              >
                借阅记录
              </Link>
            </nav>
          )}
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-violet-600 rounded-full flex items-center justify-center shadow-md shadow-cyan-500/40">
                <span className="text-white text-sm font-medium">
                  {getUserDisplayName().charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-cyan-100/85 hidden sm:inline">
                {getUserDisplayName()}
              </span>
            </div>
            {userRole === 'admin' && (
              <Link
                to="/user/home"
                className="px-4 py-2 text-sm rounded-xl text-cyan-100 border border-cyan-300/30 bg-white/10 hover:bg-white/20 transition-colors"
              >
                返回图书浏览
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm rounded-xl text-rose-100 border border-rose-300/30 bg-rose-500/15 hover:bg-rose-500/25 transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
