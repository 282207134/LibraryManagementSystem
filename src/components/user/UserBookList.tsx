import { Pagination } from '../Pagination';
import { UserBookCard } from './UserBookCard';
import type { Book } from '../../types/book';

interface UserBookListProps {
  books: Book[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void | Promise<void>;
  onBorrowSuccess?: () => void;
}

export const UserBookList = ({
  books,
  loading,
  error,
  currentPage,
  totalPages,
  onPageChange,
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
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5">
        {books.map((book) => (
          <UserBookCard key={book.id} book={book} onBorrowSuccess={onBorrowSuccess} />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(p) => void onPageChange(p)}
        loading={loading}
      />
    </div>
  );
};
