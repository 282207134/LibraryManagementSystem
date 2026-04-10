import { useCallback, useEffect, useState } from 'react';

export const USER_THEME_STORAGE_KEY = 'user-theme';

function readIsLight(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(USER_THEME_STORAGE_KEY) === 'light';
}

/** 写入本地存储（不派发事件，避免在 React setState 更新器内同步触发其它 setState） */
export function writeUserThemeToStorage(isLight: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_THEME_STORAGE_KEY, isLight ? 'light' : 'dark');
}

/** 广播主题变更，供其它 hook 实例与其它标签页同步（勿在 setState 函数体内同步调用） */
export function notifyUserThemeChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('user-theme-changed'));
}

/** 写入并广播（仅用于非 React 更新器路径，例如外部脚本） */
export function syncUserThemeToStorage(isLight: boolean) {
  writeUserThemeToStorage(isLight);
  notifyUserThemeChanged();
}

/**
 * 与用户端 UserLayout 共用 localStorage 键，管理端与前台主题一致。
 */
export function useUserThemePreference() {
  const [isLightTheme, setIsLightTheme] = useState(readIsLight);

  useEffect(() => {
    const sync = () => setIsLightTheme(readIsLight());
    window.addEventListener('storage', sync);
    window.addEventListener('user-theme-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('user-theme-changed', sync);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setIsLightTheme((prev) => {
      const next = !prev;
      writeUserThemeToStorage(next);
      return next;
    });
    // 推迟广播，避免在 setState 更新器执行栈内触发本 hook 的 listener 再次 setState（会导致切换异常）
    queueMicrotask(() => notifyUserThemeChanged());
  }, []);

  return { isLightTheme, toggleTheme };
}
