import { useUserThemePreference } from '../hooks/useUserThemePreference';
import { useLanguage } from '../contexts/LanguageContext';

type PageItem = number | 'ellipsis';

/** 与常见列表分页一致：靠前时显示 1…10，靠后时显示末段，中间显示当前页邻域 */
function buildPageItems(current: number, total: number): PageItem[] {
  if (total <= 1) return [];

  if (total <= 10) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const edgeWindow = 10;

  if (current <= edgeWindow) {
    return [...Array.from({ length: edgeWindow }, (_, i) => i + 1), 'ellipsis', total];
  }

  if (current >= total - edgeWindow + 1) {
    const start = total - edgeWindow + 1;
    return [1, 'ellipsis', ...Array.from({ length: edgeWindow }, (_, i) => start + i)];
  }

  const delta = 2;
  const mid: number[] = [];
  for (let i = current - delta; i <= current + delta; i++) {
    mid.push(i);
  }
  return [1, 'ellipsis', ...mid, 'ellipsis', total];
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export const Pagination = ({ currentPage, totalPages, onPageChange, loading }: PaginationProps) => {
  const { isLightTheme } = useUserThemePreference();
  const { language } = useLanguage();
  const textMap = {
    zh: { pagination: '分页', prev: '上一页', next: '下一页', page: '第', pageSuffix: '页' },
    en: { pagination: 'Pagination', prev: 'Previous', next: 'Next', page: 'Page ', pageSuffix: '' },
    ja: { pagination: 'ページネーション', prev: '前へ', next: '次へ', page: '第', pageSuffix: 'ページ' },
  } as const;
  const t = textMap[language];

  const btnBase = isLightTheme
    ? 'inline-flex min-h-9 min-w-9 items-center justify-center border border-amber-200 bg-white px-2 text-sm text-slate-800 transition-colors hover:bg-amber-50 disabled:pointer-events-none disabled:opacity-40 rounded-lg'
    : 'inline-flex min-h-9 min-w-9 items-center justify-center border border-cyan-300/20 bg-white/10 backdrop-blur-sm px-2 text-sm text-cyan-50 transition-colors hover:bg-cyan-500/20 disabled:pointer-events-none disabled:opacity-40 rounded-lg';

  if (totalPages <= 1) return null;

  const items = buildPageItems(currentPage, totalPages);
  const busy = Boolean(loading);
  const ellipsisMuted = isLightTheme ? 'text-slate-500 hover:bg-amber-50' : 'text-cyan-100/60 hover:bg-white/10';
  const ellipsisJump = isLightTheme ? 'text-slate-700' : 'text-cyan-100';
  const activePage = isLightTheme
    ? 'border-amber-400 bg-amber-100 text-slate-900 shadow-sm hover:bg-amber-100'
    : 'border-cyan-300/60 bg-gradient-to-r from-cyan-500/40 to-violet-500/40 text-white shadow-md shadow-cyan-500/20 hover:bg-cyan-500/40';

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label={t.pagination}>
      <button
        type="button"
        className={`${btnBase} gap-1 px-3`}
        disabled={busy || currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label={t.prev}
      >
        {t.prev}
      </button>

      {items.map((item, idx) => {
        if (item === 'ellipsis' && items[idx + 1] === totalPages) {
          return (
            <button
              key="ellipsis-last"
              type="button"
              className={`${btnBase} min-w-[4.25rem] px-2 ${ellipsisJump}`}
              disabled={busy}
              onClick={() => onPageChange(totalPages)}
              aria-label={`${t.page}${totalPages}${t.pageSuffix}`}
            >
              … {totalPages}
            </button>
          );
        }
        if (idx > 0 && items[idx - 1] === 'ellipsis' && item === totalPages) {
          return null;
        }
        if (item === 'ellipsis') {
          return (
            <span
              key={`e-${idx}`}
              className={`${btnBase} cursor-default ${ellipsisMuted}`}
              aria-hidden
            >
              …
            </span>
          );
        }
        return (
          <button
            key={item}
            type="button"
            className={`${btnBase} ${item === currentPage ? activePage : ''}`}
            disabled={busy}
            onClick={() => onPageChange(item)}
            aria-current={item === currentPage ? 'page' : undefined}
            aria-label={`${t.page}${item}${t.pageSuffix}`}
          >
            {item}
          </button>
        );
      })}

      <button
        type="button"
        className={`${btnBase} gap-1 px-3`}
        disabled={busy || currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label={t.next}
      >
        {t.next}
      </button>
    </nav>
  );
};
