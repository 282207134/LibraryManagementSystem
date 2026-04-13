import { useState } from 'react';
import { useUserThemePreference } from '../hooks/useUserThemePreference';
import { useLanguage } from '../contexts/LanguageContext';

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
}

export const SearchBar = ({ onSearch }: SearchBarProps) => {
  const { isLightTheme } = useUserThemePreference();
  const { language } = useLanguage();
  const textMap = {
    zh: { placeholder: '搜索书名或作者...', search: '搜索', clear: '清除' },
    en: { placeholder: 'Search title or author...', search: 'Search', clear: 'Clear' },
    ja: { placeholder: '書名または著者を検索...', search: '検索', clear: 'クリア' },
  } as const;
  const t = textMap[language];
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm.trim());
  };

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.placeholder}
          className={
            isLightTheme
              ? 'flex-1 px-4 py-2.5 border border-amber-200 bg-white text-slate-900 placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400'
              : 'flex-1 px-4 py-2.5 border border-cyan-300/25 bg-white/10 text-cyan-50 placeholder:text-cyan-100/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400'
          }
        />
        <button
          type="submit"
          className="px-6 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 transition-all shadow-[0_10px_26px_-10px_rgba(34,211,238,0.7)]"
        >
          {t.search}
        </button>
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className={
              isLightTheme
                ? 'px-6 py-2.5 rounded-xl text-slate-700 border border-amber-200 bg-white hover:bg-amber-50 transition-colors'
                : 'px-6 py-2.5 rounded-xl text-cyan-100 border border-cyan-300/25 bg-white/10 hover:bg-white/20 transition-colors'
            }
          >
            {t.clear}
          </button>
        )}
      </div>
    </form>
  );
};
