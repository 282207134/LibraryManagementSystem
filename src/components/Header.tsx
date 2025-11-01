import { useAuth } from '../hooks/useAuth';

export const Header = () => {
  const { user, signOut } = useAuth();

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
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">图书管理系统</h1>
            <p className="text-sm text-gray-600">管理和查看您的图书收藏</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {getUserDisplayName().charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-gray-700 hidden sm:inline">
                {getUserDisplayName()}
              </span>
            </div>
            
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
