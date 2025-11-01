import { UserBookCard } from './UserBookCard';
import type { Book } from '../../types/book';

interface UserBookListProps {
  books: Book[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onBorrowSuccess?: () => void;
}

export const UserBookList = ({
  books,
  loading,
  error,
  hasMore,
  onLoadMore,
  onBorrowSuccess,
}: UserBookListProps) => {
  if (loading && books.length === 0) {
    return <p className="text-center text-gray-500">加载图书中...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500">加载失败：{error}</p>;
  }

  if (!loading && books.length === 0) {
    return <p className="text-center text-gray-500">暂时没有找到图书，试试其他搜索关键词吧。</p>;
  }

  return (
    <div>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <UserBookCard key={book.id} book={book} onBorrowSuccess={onBorrowSuccess} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  );
};
