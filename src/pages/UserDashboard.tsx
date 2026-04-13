import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookCarousel } from '../components/BookCarousel';
import { BookRanking } from '../components/BookRanking';
import { UserBookList } from '../components/user/UserBookList';
import { useHomeData } from '../hooks/useHomeData';
import { resolveCoverImageUrl } from '../lib/storageHelper';
import { useLanguage } from '../contexts/LanguageContext';
import type { Book } from '../types/book';
import type { BookWithStats } from '../hooks/useHomeData';

export const UserDashboard = () => {
  const { language } = useLanguage();
  const textMap = {
    zh: {
      loading: '加载中...',
      featured: '⭐ 精选推荐',
      ranking: '🔥 人气排行榜',
      newArrivals: '新上架',
      browseByCategory: '分类浏览',
      categoryBooks: '分类图书',
      noNewBooks: '暂无新上架图书',
    },
    en: {
      loading: 'Loading...',
      featured: '⭐ Featured Picks',
      ranking: '🔥 Popular Ranking',
      newArrivals: 'New Arrivals',
      browseByCategory: 'Browse by Category',
      categoryBooks: 'Books in Category',
      noNewBooks: 'No new arrivals yet',
    },
    ja: {
      loading: '読み込み中...',
      featured: '⭐ 注目のおすすめ',
      ranking: '🔥 人気ランキング',
      newArrivals: '新着',
      browseByCategory: 'カテゴリで探す',
      categoryBooks: 'カテゴリの本',
      noNewBooks: '新着図書はありません',
    },
  } as const;
  const t = textMap[language];
  // 首页聚合数据读取函数
  const { 
    getRecommendedBooks, 
    getPopularBooks, 
    getNewBooks, 
    getCategories,
    getBooksByCategory
  } = useHomeData();

  // 仪表盘分区数据状态
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
        // 并行请求多个板块数据，缩短首屏等待时间
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
        
        // 自动选择第一个分类作为默认选项
        if (categoriesData.length > 0) {
          const firstCategory = categoriesData[0];
          setSelectedCategory(firstCategory);
          const books = await getBooksByCategory(firstCategory, 20);
          setCategoryBooks(books);
        }
      } catch (err) {
        console.error('加载首页数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [getRecommendedBooks, getPopularBooks, getNewBooks, getCategories, getBooksByCategory]);

  // 用户切换分类时，动态刷新分类图书列表
  const handleCategoryClick = async (category: string) => {
    setSelectedCategory(category);
    const books = await getBooksByCategory(category, 20);
    setCategoryBooks(books);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-cyan-100/70">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 推荐书籍轮播 */}
      {recommendedBooks.length > 0 && (
        <BookCarousel 
          books={recommendedBooks} 
          title={t.featured}
          autoPlay={true}
          interval={5000}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
        {/* 左侧：人气排行榜 */}
        <div className="lg:col-span-1">
          <BookRanking books={popularBooks} title={t.ranking} showRank={true} />
        </div>

        {/* 右侧：新上架图书 */}
        <div className="lg:col-span-2">
          <div className="user-dashboard-section rounded-2xl border border-white/10 bg-[#0d142d]/80 shadow-[0_16px_42px_-24px_rgba(0,0,0,0.9)] overflow-hidden h-full flex flex-col">
            <div className="user-dashboard-section-header p-5 border-b border-white/10 flex-shrink-0">
              <h2 className="text-xl font-bold text-cyan-50">{t.newArrivals}</h2>
            </div>
            <div className="p-5 flex-1">
              <NewBooksGrid books={newBooks} emptyText={t.noNewBooks} />
            </div>
          </div>
        </div>
      </div>

      {/* 分类浏览 */}
      {categories.length > 0 && (
        <div className="user-dashboard-section rounded-2xl border border-white/10 bg-[#0d142d]/80 shadow-[0_16px_42px_-24px_rgba(0,0,0,0.9)] overflow-hidden">
          <div className="user-dashboard-section-header p-5 border-b border-white/10">
            <h2 className="text-xl font-bold text-cyan-50">{t.browseByCategory}</h2>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-2.5 mb-5">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryClick(category)}
                  className={`user-category-chip px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedCategory === category
                      ? 'user-category-chip-active bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
                      : 'user-category-chip-inactive bg-white/10 text-cyan-100 hover:bg-white/20'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {selectedCategory && categoryBooks.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-cyan-50 mb-3">
                  {selectedCategory} {t.categoryBooks}
                </h3>
                <UserBookList
                  books={categoryBooks}
                  loading={false}
                  error={null}
                  currentPage={1}
                  totalPages={1}
                  onPageChange={() => {}}
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
  emptyText: string;
}

const NewBooksGrid = ({ books, emptyText }: NewBooksGridProps) => {
  // 缓存封面解析结果，避免重复解析同一 URL
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const loadCovers = async () => {
      const urlMap = new Map<string, string>();
      // 顺序解析封面，失败不影响其他书籍展示
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
    return <p className="text-cyan-100/70 text-center py-8">{emptyText}</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 min-h-[400px]">
      {books.map((book) => (
        <Link
          key={book.id}
          to={`/user/books/${book.id}`}
          className="group"
        >
          <div className="user-new-book-tile rounded-xl overflow-hidden border border-white/10 bg-[#131d3a] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)] hover:border-cyan-300/40 hover:shadow-[0_16px_36px_-18px_rgba(34,211,238,0.45)] transition-all">
            <div className="user-new-book-cover aspect-[3/4] bg-slate-800 overflow-hidden">
              {coverUrls.get(book.id) ? (
                <img
                  src={coverUrls.get(book.id)}
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-cyan-200/70">
                  <span className="text-4xl">📖</span>
                </div>
              )}
            </div>
            <div className="p-3">
              <h3 className="font-semibold text-sm text-cyan-50 truncate mb-1" title={book.title}>
                {book.title}
              </h3>
              <p className="text-xs text-cyan-100/70 truncate">{book.author}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

