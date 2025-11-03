import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { UserLayout } from './components/user/UserLayout';
import { UserHome } from './pages/UserHome';
import { UserDashboard } from './pages/UserDashboard';
import { UserMyBorrowings } from './pages/UserMyBorrowings';
import { UserFavorites } from './pages/UserFavorites';
import { UserBookDetail } from './pages/UserBookDetail';
import { ResetPassword } from './pages/ResetPassword';

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

  return (
    <Routes>
      {/* 密码重置页面（不需要登录，必须在最前面） */}
      <Route path="/reset-password" element={<ResetPassword />} />

      {!user ? (
        /* 未登录用户：显示登录/注册页面 */
        <>
          <Route
            path="*"
            element={
              authMode === 'login' ? (
                <Login onToggleMode={() => setAuthMode('register')} />
              ) : (
                <Register onToggleMode={() => setAuthMode('login')} />
              )
            }
          />
        </>
      ) : (
        /* 已登录用户：显示应用内容 */
        <>
          {/* 用户界面路由 */}
          <Route path="/user" element={<UserLayout />}>
            <Route index element={<Navigate to="/user/dashboard" replace />} />
            <Route path="dashboard" element={<UserDashboard />} />
            <Route path="home" element={<UserHome />} />
            <Route path="books" element={<UserHome />} />
            <Route path="books/:id" element={<UserBookDetail />} />
            <Route path="my-borrowings" element={<UserMyBorrowings />} />
            <Route path="my-favorites" element={<UserFavorites />} />
            <Route path="profile" element={<div className="p-8 text-center text-gray-500">个人中心页面开发中...</div>} />
          </Route>

          {/* 管理员界面路由（仅管理员可访问） */}
          <Route
            path="/admin/*"
            element={userRole === 'admin' ? <AdminApp /> : <Navigate to="/user/dashboard" replace />}
          />

          {/* 默认重定向到用户首页 */}
          <Route path="/" element={<Navigate to="/user/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/user/dashboard" replace />} />
        </>
      )}
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
