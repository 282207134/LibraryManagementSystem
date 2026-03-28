import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserBookList } from '../components/user/UserBookList';
import { useBooks } from '../hooks/useBooks';

export const UserHome = () => {
  const [searchParams] = useSearchParams();
  const { books, loading, error, page, totalPages, searchBooks, goToPage, refresh } = useBooks();

  // 从 URL 参数获取搜索词
  useEffect(() => {
    const searchTerm = searchParams.get('search');
    if (searchTerm) {
      searchBooks(searchTerm);
    }
  }, [searchParams, searchBooks]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">图书浏览</h1>
        <p className="text-sm text-gray-600">发现感兴趣的图书，立即借阅</p>
      </div>

      <UserBookList
        books={books}
        loading={loading}
        error={error}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={goToPage}
        onBorrowSuccess={refresh}
      />
    </div>
  );
};
