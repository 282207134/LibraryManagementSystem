import { Outlet } from 'react-router-dom';
import { useUserThemePreference } from '../../hooks/useUserThemePreference';
import { ChatAssistant } from '../assistant/ChatAssistant';
import { UserHeader } from './UserHeader';

export const UserLayout = () => {
  const { isLightTheme, toggleTheme } = useUserThemePreference();

  return (
    <div
      className={`user-theme min-h-screen text-gray-100 transition-colors ${isLightTheme ? 'bg-[#f7f3e8]' : 'bg-[#060a19]'}`}
      data-theme={isLightTheme ? 'light' : 'dark'}
    >
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className={`absolute top-8 left-6 h-64 w-64 rounded-full blur-3xl ${isLightTheme ? 'bg-amber-300/35' : 'bg-cyan-500/10'}`} />
        <div className={`absolute top-1/3 right-10 h-72 w-72 rounded-full blur-3xl ${isLightTheme ? 'bg-orange-200/35' : 'bg-violet-500/10'}`} />
      </div>
      <UserHeader isLightTheme={isLightTheme} onToggleTheme={toggleTheme} />
      <main className="max-w-[72rem] mx-auto px-3 py-4">
        <Outlet />
      </main>
      <ChatAssistant />
    </div>
  );
};
