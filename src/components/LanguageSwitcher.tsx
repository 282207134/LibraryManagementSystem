import { useEffect, useRef, useState } from 'react';
import { useLanguage, type AppLanguage } from '../contexts/LanguageContext';

const options: Array<{ value: AppLanguage; label: string }> = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
];

const titleMap: Record<AppLanguage, string> = {
  zh: '切换语言',
  en: 'Switch language',
  ja: '言語を切り替え',
};

type LanguageSwitcherProps = {
  className?: string;
  light?: boolean;
};

export const LanguageSwitcher = ({ className = '', light = false }: LanguageSwitcherProps) => {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex ${className}`}
    >
      <button
        type="button"
        title={titleMap[language]}
        aria-label={titleMap[language]}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`h-9 w-9 rounded-lg border p-2 transition-colors ${
          light
            ? 'border-amber-200 bg-amber-50/70 text-slate-700 hover:bg-amber-100 hover:text-slate-900'
            : 'border-white/20 bg-white/10 text-white/85 hover:bg-white/15 hover:text-white'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.8 2.5 4.2 5.5 4.2 9s-1.4 6.5-4.2 9c-2.8-2.5-4.2-5.5-4.2-9s1.4-6.5 4.2-9z" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className={`absolute right-0 top-11 z-50 min-w-32 rounded-xl border p-1.5 shadow-xl ${
            light ? 'border-amber-200 bg-[#fffaf0] text-slate-800' : 'border-white/20 bg-[#0b1024]/95 text-white'
          }`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              onClick={() => {
                setLanguage(option.value);
                setOpen(false);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                language === option.value
                  ? 'bg-cyan-500 text-white'
                  : light
                    ? 'hover:bg-amber-100'
                    : 'hover:bg-white/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
