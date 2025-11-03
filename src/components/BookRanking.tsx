import { Link } from 'react-router-dom';
import { resolveCoverImageUrl } from '../lib/storageHelper';
import { StarRating } from './StarRating';
import { useState, useEffect } from 'react';
import type { BookWithStats } from '../hooks/useHomeData';

interface BookRankingProps {
  books: BookWithStats[];
  title: string;
  showRank?: boolean;
}

export const BookRanking = ({ books, title, showRank = true }: BookRankingProps) => {
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
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
      <div className="p-5 border-b flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>

      <div className="divide-y flex-1">
        {books.map((book, index) => (
          <Link
            key={book.id}
            to={`/user/books/${book.id}`}
            className="block p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {/* 排名 */}
              {showRank && (
                <div className="flex-shrink-0 w-10 text-center">
                  <span
                    className={`text-xl font-bold ${
                      index < 3 ? 'text-yellow-500' : 'text-gray-400'
                    }`}
                  >
                    {index + 1}
                  </span>
                </div>
              )}

              {/* 封面 */}
              <div className="flex-shrink-0 w-16 h-24 rounded overflow-hidden bg-gray-200">
                {coverUrls.get(book.id) ? (
                  <img
                    src={coverUrls.get(book.id)}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl">📖</span>
                  </div>
                )}
              </div>

              {/* 图书信息 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
                  {book.title}
                </h3>
                <p className="text-xs text-gray-600 mb-1.5">作者：{book.author}</p>
                
                <div className="flex items-center gap-4">
                  {book.average_rating && book.average_rating > 0 && (
                    <div className="flex items-center gap-2">
                      <StarRating rating={book.average_rating} readonly size="sm" />
                      <span className="text-xs text-gray-500">
                        {book.review_count || 0} 评论
                      </span>
                    </div>
                  )}
                  
                  {book.borrow_count !== undefined && (
                    <span className="text-sm text-gray-600">
                      借阅 {book.borrow_count} 次
                    </span>
                  )}
                </div>
              </div>

              {/* 箭头 */}
              <div className="flex-shrink-0 text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

