import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const UserHeader = () => {
  const { userProfile, userRole, signOut } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

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
    <header className="bg-white shadow-sm">
      <div className="max-w-[72rem] mx-auto px-3 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-6 flex-shrink-0">
            <Link to="/user/dashboard" className="text-lg font-bold text-blue-600">
              📚 图书馆
            </Link>
            <nav className="hidden md:flex items-center space-x-4">
              <Link
                to="/user/dashboard"
                className="text-gray-700 hover:text-blue-600 transition-colors text-sm"
              >
                首页
              </Link>
              <Link
                to="/user/home"
                className="text-gray-700 hover:text-blue-600 transition-colors text-sm"
              >
                图书浏览
              </Link>
              <Link
                to="/user/my-borrowings"
                className="text-gray-700 hover:text-blue-600 transition-colors text-sm"
              >
                我的借阅
              </Link>
              <Link
                to="/user/my-favorites"
                className="text-gray-700 hover:text-blue-600 transition-colors text-sm"
              >
                我的收藏
              </Link>
              <Link
                to="/user/profile"
                className="text-gray-700 hover:text-blue-600 transition-colors text-sm"
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
                  className="w-32 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs whitespace-nowrap"
                >
                  搜索
                </button>
              </form>
              {userRole === 'admin' && (
                <Link
                  to="/admin/dashboard"
                  className="text-red-600 hover:text-red-700 transition-colors font-medium text-sm"
                >
                  管理后台
                </Link>
              )}
            </nav>
          </div>
          
          <div className="flex items-center space-x-3 flex-shrink-0">
              <span className="text-gray-700">
                👤 {userProfile?.full_name || '用户'}
                {userRole === 'admin' && (
                  <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                    管理员
                  </span>
                )}
              </span>
              {userRole === 'admin' && (
                <Link
                  to="/admin"
                  className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  管理后台
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </header>
  );
};
