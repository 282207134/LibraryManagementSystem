import { Outlet } from 'react-router-dom';
import { UserHeader } from './UserHeader';

export const UserLayout = () => {
  return (
    <div className="min-h-screen bg-[#060a19] text-gray-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-8 left-6 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/3 right-10 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
      </div>
      <UserHeader />
      <main className="max-w-[72rem] mx-auto px-3 py-4">
        <Outlet />
      </main>
    </div>
  );
};
