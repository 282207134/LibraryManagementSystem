import { SearchBar } from '../components/SearchBar';
import { UserBookList } from '../components/user/UserBookList';
import { useBooks } from '../hooks/useBooks';

export const UserHome = () => {
  const { books, loading, error, hasMore, searchBooks, loadMore, refresh } = useBooks();

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
