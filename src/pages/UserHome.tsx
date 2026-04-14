import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserBookList } from '../components/user/UserBookList';
import { useBooks } from '../hooks/useBooks';
import { useLanguage } from '../contexts/LanguageContext';

export const UserHome = () => {
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const titleMap = {
    zh: '图书浏览',
    en: 'Browse Books',
    ja: '図書を探す',
  } as const;
  // 复用 useBooks 的分页/搜索/刷新能力
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
      <div className="user-home-hero mb-2 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-cyan-50 mb-2">{titleMap[language]}</h1>
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
