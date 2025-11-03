import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveCoverImageUrl } from '../lib/storageHelper';
import { StarRating } from './StarRating';
import type { BookWithStats } from '../hooks/useHomeData';

interface BookCarouselProps {
  books: BookWithStats[];
  title: string;
  autoPlay?: boolean;
  interval?: number; // 毫秒
}

export const BookCarousel = ({ books, title, autoPlay = true, interval = 5000 }: BookCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map());

  // 加载封面图片
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

  // 自动播放
  useEffect(() => {
    if (!autoPlay || books.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % books.length);
    }, interval);

    return () => clearInterval(timer);
  }, [autoPlay, interval, books.length]);

  if (books.length === 0) {
    return null;
  }

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + books.length) % books.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % books.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      </div>

      <div className="relative">
        {/* 轮播内容 */}
        <div className="relative h-96 overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out h-full"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {books.map((book) => (
              <div key={book.id} className="min-w-full h-full flex items-center bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="container mx-auto px-8 flex items-center gap-8 h-full">
                  {/* 封面图片 */}
                  <div className="flex-shrink-0 w-64 h-80 shadow-2xl rounded-lg overflow-hidden">
                    {coverUrls.get(book.id) ? (
                      <img
                        src={coverUrls.get(book.id)}
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-6xl">📖</span>
                      </div>
                    )}
                  </div>

                  {/* 图书信息 */}
                  <div className="flex-1">
                    <h3 className="text-4xl font-bold text-gray-900 mb-4">{book.title}</h3>
                    <p className="text-xl text-gray-600 mb-4">作者：{book.author}</p>
                    
                    {book.category && (
                      <p className="text-lg text-gray-500 mb-4">分类：{book.category}</p>
                    )}

                    {book.average_rating && book.average_rating > 0 && (
                      <div className="mb-4">
                        <StarRating rating={book.average_rating} readonly size="lg" showText />
                        <span className="ml-2 text-gray-600">
                          ({book.review_count || 0} 条评论)
                        </span>
                      </div>
                    )}

                    {book.description && (
                      <p className="text-gray-700 mb-6 line-clamp-3">{book.description}</p>
                    )}

                    <Link
                      to={`/user/books/${book.id}`}
                      className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 左右箭头 */}
        {books.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-3 shadow-lg transition-all"
              aria-label="上一本"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-3 shadow-lg transition-all"
              aria-label="下一本"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* 指示器 */}
        {books.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {books.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentIndex ? 'bg-blue-600 w-8' : 'bg-white/60 hover:bg-white/80'
                }`}
                aria-label={`切换到第 ${index + 1} 本`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

