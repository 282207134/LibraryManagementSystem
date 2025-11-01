import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { UserLayout } from './components/user/UserLayout';
import { UserHome } from './pages/UserHome';
import { UserMyBorrowings } from './pages/UserMyBorrowings';
import { UserFavorites } from './pages/UserFavorites';

// 旧的管理员界面暂时保留
import AdminApp from './AdminApp';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-600">加载中...</p>
    </div>
  );
}

function AuthRoutes() {
  const { user, userRole, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <div>
        {authMode === 'login' ? (
          <Login onToggleMode={() => setAuthMode('register')} />
        ) : (
          <Register onToggleMode={() => setAuthMode('login')} />
        )}
      </div>
    );
  }

  return (
    <Routes>
      {/* 用户界面路由 */}
      <Route path="/user" element={<UserLayout />}>
        <Route index element={<Navigate to="/user/home" replace />} />
        <Route path="home" element={<UserHome />} />
        <Route path="books" element={<UserHome />} />
        <Route path="my-borrowings" element={<UserMyBorrowings />} />
        <Route path="my-favorites" element={<UserFavorites />} />
        <Route path="profile" element={<div className="p-8 text-center text-gray-500">个人中心页面开发中...</div>} />
      </Route>

      {/* 管理员界面路由（仅管理员可访问） */}
      <Route
        path="/admin/*"
        element={userRole === 'admin' ? <AdminApp /> : <Navigate to="/user/home" replace />}
      />

      {/* 默认重定向到用户首页 */}
      <Route path="/" element={<Navigate to="/user/home" replace />} />
      <Route path="*" element={<Navigate to="/user/home" replace />} />
    </Routes>
  );
}

function AppWithRouter() {
  return (
    <BrowserRouter>
      <AuthRoutes />
    </BrowserRouter>
  );
}

export default AppWithRouter;
