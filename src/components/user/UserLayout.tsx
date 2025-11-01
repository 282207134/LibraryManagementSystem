import { Outlet } from 'react-router-dom';
import { UserHeader } from './UserHeader';

export const UserLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <UserHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};
