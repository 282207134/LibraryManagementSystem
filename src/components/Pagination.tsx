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

const btnBase =
  'inline-flex min-h-9 min-w-9 items-center justify-center border border-cyan-300/20 bg-white/10 backdrop-blur-sm px-2 text-sm text-cyan-50 transition-colors hover:bg-cyan-500/20 disabled:pointer-events-none disabled:opacity-40 rounded-lg';

export const Pagination = ({ currentPage, totalPages, onPageChange, loading }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const items = buildPageItems(currentPage, totalPages);
  const busy = Boolean(loading);

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="分页">
      <button
        type="button"
        className={`${btnBase} gap-1 px-3`}
        disabled={busy || currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="上一页"
      >
        上一页
      </button>

      {items.map((item, idx) => {
        if (item === 'ellipsis' && items[idx + 1] === totalPages) {
          return (
            <button
              key="ellipsis-last"
              type="button"
              className={`${btnBase} min-w-[4.25rem] px-2 text-cyan-100`}
              disabled={busy}
              onClick={() => onPageChange(totalPages)}
              aria-label={`第 ${totalPages} 页`}
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
              className={`${btnBase} cursor-default text-cyan-100/60 hover:bg-white/10`}
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
            className={`${btnBase} ${
              item === currentPage
                ? 'border-cyan-300/60 bg-gradient-to-r from-cyan-500/40 to-violet-500/40 text-white shadow-md shadow-cyan-500/20 hover:bg-cyan-500/40'
                : ''
            }`}
            disabled={busy}
            onClick={() => onPageChange(item)}
            aria-current={item === currentPage ? 'page' : undefined}
            aria-label={`第 ${item} 页`}
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
        aria-label="下一页"
      >
        下一页
      </button>
    </nav>
  );
};
