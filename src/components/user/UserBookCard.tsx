import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBorrowings } from '../../hooks/useBorrowings';
import { useFavorites } from '../../hooks/useFavorites';
import { useReviews } from '../../hooks/useReviews';
import { resolveCoverImageUrl } from '../../lib/storageHelper';
import { StarRating } from '../StarRating';
import type { Book } from '../../types/book';

interface UserBookCardProps {
  book: Book;
  onBorrowSuccess?: () => void;
}

export const UserBookCard = ({ book, onBorrowSuccess }: UserBookCardProps) => {
  const { user } = useAuth();
  const { borrowBook, hasUserBorrowedBook } = useBorrowings();
  const { favoriteBook, unfavoriteBook, isBookFavorited } = useFavorites();
  const { getBookRatingStats } = useReviews();
  const [isBorrowed, setIsBorrowed] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [averageRating, setAverageRating] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      hasUserBorrowedBook(user.id, book.id).then(setIsBorrowed);
      isBookFavorited(book.id, user.id).then(setIsFavorite);
    } else {
      setIsBorrowed(false);
      setIsFavorite(false);
    }
  }, [user, book.id, hasUserBorrowedBook, isBookFavorited]);

  // 解析封面图片 URL
  useEffect(() => {
    if (book.cover_image_url) {
      resolveCoverImageUrl(book.cover_image_url).then(setCoverImageUrl);
    } else {
      setCoverImageUrl(null);
    }
  }, [book.cover_image_url]);

  // 加载评分统计
  useEffect(() => {
    const loadRating = async () => {
      const stats = await getBookRatingStats(book.id);
      if (stats && stats.total_reviews > 0) {
        setAverageRating(stats.average_rating);
      } else {
        setAverageRating(null);
      }
    };
    loadRating();
  }, [book.id, getBookRatingStats]);

  const handleBorrow = async () => {
    if (!user) return;

    if (
      !window.confirm(
        `确定借阅《${book.title}》吗？\n确认后将占用您的借阅名额并更新可借数量。`
      )
    ) {
      return;
    }

    setLoading(true);

    let dueDate: string | undefined;
    let borrowSucceeded = false;
    let errorMessage: string | null = null;

    try {
      const result = await borrowBook(book.id, user.id);
      borrowSucceeded = !!result.success;

      if (result.due_date) {
        dueDate = result.due_date;
      }

      if (!result.success) {
        errorMessage = result.error || '借阅失败，请稍后重试';
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '借阅失败，请稍后重试';
    }

    const actualBorrowStatus = await hasUserBorrowedBook(user.id, book.id);
    setIsBorrowed(actualBorrowStatus);
    setLoading(false);

    if (actualBorrowStatus) {
      const message = dueDate
        ? `借阅成功！到期日期：${new Date(dueDate).toLocaleDateString()}`
        : borrowSucceeded
          ? '借阅成功！'
          : '借阅成功！可以在"我的借阅"中查看详情。';

      alert(message);
      onBorrowSuccess?.();
      return;
    }

    const finalError = errorMessage || '借阅失败，请稍后重试';
    alert(`借阅失败：${finalError}`);
  };

  const handleToggleFavorite = async () => {
    if (!user) return;
    setLoading(true);

    if (isFavorite) {
      const success = await unfavoriteBook(book.id, user.id);
      if (success) {
        setIsFavorite(false);
      }
    } else {
      const success = await favoriteBook(book.id, user.id);
      if (success) {
        setIsFavorite(true);
      }
    }
    setLoading(false);
  };

  const isAvailable = book.available_quantity > 0;

  return (
    <div className="user-book-card group relative rounded-2xl border border-white/10 bg-[#0f1630]/80 backdrop-blur-sm overflow-hidden hover:border-cyan-300/40 hover:shadow-[0_16px_50px_-20px_rgba(34,211,238,0.55)] transition-all flex flex-col w-full h-full">
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_50%)]" />
      {/* 封面区域 - 增加高度使卡片更高 */}
      <Link to={`/user/books/${book.id}`} className="user-book-cover block h-48 bg-slate-900 overflow-hidden flex-shrink-0 relative cursor-pointer">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              // 如果图片加载失败，显示占位符
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const placeholder = target.nextElementSibling as HTMLElement;
              if (placeholder) placeholder.style.display = 'flex';
            }}
          />
        ) : null}
        <div className={`absolute inset-0 w-full h-full bg-slate-800 flex items-center justify-center text-cyan-200/60 ${coverImageUrl ? 'hidden' : ''}`}>
          <span className="text-2xl">📖</span>
        </div>
      </Link>
      {/* 内容区域 - 减小内边距 */}
      <div className="p-3 flex-1 flex flex-col">
        <Link to={`/user/books/${book.id}`} className="cursor-pointer">
          <h3 className="font-bold text-base text-cyan-50 hover:text-cyan-300 transition-colors truncate leading-tight">
            {book.title}
          </h3>
        </Link>
        <p className="user-book-meta text-cyan-100/70 text-xs mt-0.5 truncate">作者：{book.author}</p>
        {book.category && (
          <p className="user-book-meta text-cyan-100/60 text-xs mt-0.5">分类：{book.category}</p>
        )}
        {averageRating !== null && (
          <div className="mt-1.5">
            <StarRating rating={averageRating} readonly size="sm" showText />
          </div>
        )}
        <p className={`text-xs mt-1.5 ${isAvailable ? 'text-emerald-300' : 'text-rose-300'}`}>
          可借：{book.available_quantity}/{book.quantity}
        </p>

        {/* 按钮区域 - 减小按钮尺寸和间距 */}
        <div className="mt-auto pt-2 flex gap-1.5">
          <button
            onClick={handleBorrow}
            disabled={!isAvailable || isBorrowed || loading}
            className={`flex-1 px-2.5 py-1.5 rounded text-white text-xs font-medium transition-colors ${
              !isAvailable || isBorrowed
                ? 'bg-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500'
            }`}
          >
            {isBorrowed ? '已借阅' : isAvailable ? '立即借阅' : '库存不足'}
          </button>
          <button
            onClick={handleToggleFavorite}
            disabled={loading}
            className={`user-fav-btn px-2 py-1.5 rounded transition-colors ${
              isFavorite
                ? 'user-fav-btn-active bg-amber-300/25 text-amber-200 hover:bg-amber-300/35'
                : 'bg-white/10 text-cyan-100/80 hover:bg-white/20'
            }`}
            title={isFavorite ? '取消收藏' : '收藏'}
          >
            <span className="text-xs">{isFavorite ? '⭐' : '☆'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
