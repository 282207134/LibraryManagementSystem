import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { BookCarousel } from '../components/BookCarousel';
import { BookRanking } from '../components/BookRanking';
import { UserBookList } from '../components/user/UserBookList';
import { useHomeData } from '../hooks/useHomeData';
import { useBooks } from '../hooks/useBooks';
import { resolveCoverImageUrl } from '../lib/storageHelper';
import type { Book } from '../types/book';
import type { BookWithStats } from '../hooks/useHomeData';

export const UserDashboard = () => {
  const { 
    getRecommendedBooks, 
    getPopularBooks, 
    getNewBooks, 
    getCategories,
    getBooksByCategory
  } = useHomeData();

  const { searchBooks } = useBooks();

  const [recommendedBooks, setRecommendedBooks] = useState<BookWithStats[]>([]);
  const [popularBooks, setPopularBooks] = useState<BookWithStats[]>([]);
  const [newBooks, setNewBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryBooks, setCategoryBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHomeData = async () => {
      setLoading(true);
      try {
        const [recommended, popular, newBooksData, categoriesData] = await Promise.all([
          getRecommendedBooks(8),
          getPopularBooks(4),
          getNewBooks(10),
          getCategories(),
        ]);

        setRecommendedBooks(recommended);
        setPopularBooks(popular);
        setNewBooks(newBooksData);
        setCategories(categoriesData);
      } catch (err) {
        console.error('加载首页数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [getRecommendedBooks, getPopularBooks, getNewBooks, getCategories]);

  const handleCategoryClick = async (category: string) => {
    setSelectedCategory(category);
    const books = await getBooksByCategory(category, 20);
    setCategoryBooks(books);
  };

  const handleSearch = (term: string) => {
    searchBooks(term);
    // 跳转到图书浏览页面
    window.location.href = `/user/home?search=${encodeURIComponent(term)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 顶部搜索栏 */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">欢迎来到图书馆</h1>
          <p className="text-xl mb-6 text-blue-100">发现好书，开启阅读之旅</p>
          <SearchBar onSearch={handleSearch} />
        </div>
      </div>

      {/* 推荐书籍轮播 */}
      {recommendedBooks.length > 0 && (
        <BookCarousel 
          books={recommendedBooks} 
          title="⭐ 精选推荐" 
          autoPlay={true}
          interval={5000}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
        {/* 左侧：人气排行榜 */}
        <div className="lg:col-span-1">
          <BookRanking books={popularBooks} title="🔥 人气排行榜" showRank={true} />
        </div>

        {/* 右侧：新上架图书 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b flex-shrink-0">
              <h2 className="text-2xl font-bold text-gray-900">📚 新上架</h2>
            </div>
            <div className="p-6 flex-1">
              <NewBooksGrid books={newBooks} />
            </div>
          </div>
        </div>
      </div>

      {/* 分类浏览 */}
      {categories.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">📖 分类浏览</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-3 mb-6">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {selectedCategory && categoryBooks.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {selectedCategory} 分类图书
                </h3>
                <UserBookList
                  books={categoryBooks}
                  loading={false}
                  error={null}
                  hasMore={false}
                  onLoadMore={() => {}}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 新上架图书网格组件
interface NewBooksGridProps {
  books: Book[];
}

const NewBooksGrid = ({ books }: NewBooksGridProps) => {
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const loadCovers = async () => {
      const urlMap = new Map<string, string>();
      for (const book of books) {
        if (book.cover_image_url) {
          try {
            const url = await resolveCoverImageUrl(book.cover_image_url);
            if (url) urlMap.set(book.id, url);
          } catch (err) {
            console.error(`加载封面失败 ${book.id}:`, err);
          }
        }
      }
      setCoverUrls(urlMap);
    };
    loadCovers();
  }, [books]);

  if (books.length === 0) {
    return <p className="text-gray-500 text-center py-8">暂无新上架图书</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 min-h-[400px]">
      {books.map((book) => (
        <Link
          key={book.id}
          to={`/user/books/${book.id}`}
          className="group"
        >
          <div className="bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow">
            <div className="aspect-[3/4] bg-gray-200 overflow-hidden">
              {coverUrls.get(book.id) ? (
                <img
                  src={coverUrls.get(book.id)}
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl">📖</span>
                </div>
              )}
            </div>
            <div className="p-3">
              <h3 className="font-semibold text-sm text-gray-900 truncate mb-1" title={book.title}>
                {book.title}
              </h3>
              <p className="text-xs text-gray-600 truncate">{book.author}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

