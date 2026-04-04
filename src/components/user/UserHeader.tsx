import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BrandLogo } from '../BrandLogo';

export const UserHeader = () => {
  const { user, userProfile, userRole, signOut } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

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
    return user?.email?.split('@')[0] || '用户';
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/user/home?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1024]/80 backdrop-blur-xl shadow-[0_8px_32px_-16px_rgba(0,0,0,0.7)]">
      <div className="max-w-[72rem] mx-auto px-3 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-6 flex-shrink-0">
            <Link
              to="/user/dashboard"
              className="flex items-center gap-2 text-lg font-bold text-cyan-300 drop-shadow hover:opacity-90 transition-opacity"
            >
              <BrandLogo size="sm" className="ring-1 ring-cyan-400/40" />
              <span>图书馆</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-4">
              <Link
                to="/user/dashboard"
                className="text-cyan-50/80 hover:text-cyan-300 transition-colors text-sm"
              >
                首页
              </Link>
              <Link
                to="/user/home"
                className="text-cyan-50/80 hover:text-cyan-300 transition-colors text-sm"
              >
                图书浏览
              </Link>
              <Link
                to="/user/my-borrowings"
                className="text-cyan-50/80 hover:text-cyan-300 transition-colors text-sm"
              >
                我的借阅
              </Link>
              <Link
                to="/user/my-favorites"
                className="text-cyan-50/80 hover:text-cyan-300 transition-colors text-sm"
              >
                我的收藏
              </Link>
              <Link
                to="/user/profile"
                className="text-cyan-50/80 hover:text-cyan-300 transition-colors text-sm"
              >
                个人中心
              </Link>
              {/* 搜索框 - 放在个人中心后面 */}
              <form onSubmit={handleSearch} className="ml-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索书名或作者..."
                  className="w-40 px-3 py-1.5 border border-cyan-300/30 bg-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400 text-xs text-white placeholder:text-cyan-100/50"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-violet-600 text-white rounded-lg hover:from-cyan-400 hover:to-violet-500 transition-colors text-xs whitespace-nowrap"
                >
                  搜索
                </button>
              </form>
            </nav>
          </div>
          
          <div className="flex items-center space-x-3 flex-shrink-0">
              <span className="text-cyan-50/90">
                👤 {getUserDisplayName()}
                {userRole === 'admin' && (
                  <span className="ml-2 text-xs bg-rose-500/20 text-rose-200 px-2 py-1 rounded border border-rose-300/30">
                    管理员
                  </span>
                )}
              </span>
              {userRole === 'admin' && (
                <Link
                  to="/admin/dashboard"
                  className="text-rose-300 hover:text-rose-200 transition-colors font-medium text-sm"
                >
                  管理后台
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm text-cyan-50/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/10"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </header>
  );
};
