import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const UserHeader = () => {
  const { userProfile, userRole, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link to="/user/home" className="text-2xl font-bold text-blue-600">
            📚 图书馆
          </Link>
          <nav className="hidden md:flex space-x-6">
            <Link
              to="/user/home"
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              首页
            </Link>
            <Link
              to="/user/books"
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              图书浏览
            </Link>
            <Link
              to="/user/my-borrowings"
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              我的借阅
            </Link>
            <Link
              to="/user/my-favorites"
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              我的收藏
            </Link>
            <Link
              to="/user/profile"
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              个人中心
            </Link>
            {userRole === 'admin' && (
              <Link
                to="/admin/dashboard"
                className="text-red-600 hover:text-red-700 transition-colors font-medium"
              >
                管理后台
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center space-x-4">
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
    </header>
  );
};
