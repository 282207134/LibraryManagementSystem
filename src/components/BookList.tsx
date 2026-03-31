import { useState, useEffect } from 'react';
import type { Book } from '../types/book';
import { BookCard } from './BookCard';
import { Pagination } from './Pagination';
import { resolveCoverImageUrl } from '../lib/storageHelper';

interface BookListProps {
  books: Book[];
  loading: boolean;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void | Promise<void>;
}

const CoverThumbnail = ({ coverUrl, title }: { coverUrl?: string | null; title: string }) => {
  const [failed, setFailed] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const loadImage = async () => {
      if (coverUrl) {
        const url = await resolveCoverImageUrl(coverUrl);
        if (mounted) {
          setResolvedUrl(url);
          setFailed(false);
        }
      } else {
        setResolvedUrl(null);
      }
    };

    loadImage();

    return () => {
      mounted = false;
    };
  }, [coverUrl]);

  if (!resolvedUrl || failed) {
    return (
      <div className="w-12 h-16 bg-slate-800 border border-white/10 rounded flex items-center justify-center text-xs text-cyan-100/60">
        无封面
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={`${title} 封面`}
      className="w-12 h-16 object-cover rounded border border-white/10"
      onError={() => setFailed(true)}
    />
  );
};

export const BookList = ({
  books,
  loading,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
}: BookListProps) => {
  if (loading && books.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-cyan-100/70">加载中...</p>
      </div>
    );
  }

  if (!loading && books.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-cyan-100/70">暂无图书，请添加新图书。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="hidden md:block overflow-hidden border border-white/10 rounded-2xl bg-[#0d142c]/85 backdrop-blur-sm">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cyan-100/70 uppercase tracking-wider">
                封面
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cyan-100/70 uppercase tracking-wider">
                书名
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cyan-100/70 uppercase tracking-wider">
                作者
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cyan-100/70 uppercase tracking-wider">
                ISBN
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cyan-100/70 uppercase tracking-wider">
                分类
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cyan-100/70 uppercase tracking-wider">
                库存
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cyan-100/70 uppercase tracking-wider">
                可借
              </th>
              <th scope="col" className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {books.map((book) => (
              <tr key={book.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <CoverThumbnail coverUrl={book.cover_image_url} title={book.title} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-cyan-50">
                  <div className="flex flex-col">
                    <span>{book.title}</span>
                    {book.publisher && (
                      <span className="text-xs text-cyan-100/60">{book.publisher}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-100/75">{book.author}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-100/75">{book.isbn || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-100/75">{book.category || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-100/75">{book.quantity}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-100/75">{book.available_quantity}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2 justify-end">
                  <button
                    onClick={() => onEdit(book)}
                    className="px-4 py-2 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 transition-all shadow-[0_10px_20px_-12px_rgba(34,211,238,0.7)]"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => onDelete(book)}
                    className="px-4 py-2 text-sm font-medium text-rose-100 rounded-xl border border-rose-300/30 bg-rose-500/15 hover:bg-rose-500/25 transition-colors"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden grid gap-4">
        {books.map((book) => (
          <BookCard key={book.id} book={book} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>

      {loading && books.length > 0 && (
        <p className="text-center text-sm text-cyan-100/70">加载中...</p>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(p) => void onPageChange(p)}
        loading={loading}
      />
    </div>
  );
};
