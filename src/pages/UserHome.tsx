import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { UserBookList } from '../components/user/UserBookList';
import { useBooks } from '../hooks/useBooks';

export const UserHome = () => {
  const [searchParams] = useSearchParams();
  const { books, loading, error, hasMore, searchBooks, loadMore, refresh } = useBooks();

  // 从 URL 参数获取搜索词
  useEffect(() => {
    const searchTerm = searchParams.get('search');
    if (searchTerm) {
      searchBooks(searchTerm);
    }
  }, [searchParams, searchBooks]);

  const handleSearch = (term: string) => {
    searchBooks(term);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">图书浏览</h1>
        <p className="text-gray-600">发现感兴趣的图书，立即借阅</p>
      </div>

      <div className="mb-6">
        <SearchBar onSearch={handleSearch} />
      </div>

      <UserBookList
        books={books}
        loading={loading}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onBorrowSuccess={refresh}
      />
    </div>
  );
};
