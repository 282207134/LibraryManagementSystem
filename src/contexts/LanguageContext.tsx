import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type AppLanguage = 'zh' | 'en' | 'ja';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  speechLocale: string;
};

const STORAGE_KEY = 'library_app_language';

const speechLocaleMap: Record<AppLanguage, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'zh';
  const cached = window.localStorage.getItem(STORAGE_KEY);
  if (cached === 'zh' || cached === 'en' || cached === 'ja') return cached;
  return 'zh';
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<AppLanguage>(getInitialLanguage);

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, lang);
    }
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      speechLocale: speechLocaleMap[language],
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
