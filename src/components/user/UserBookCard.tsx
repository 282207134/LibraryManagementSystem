import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBorrowings } from '../../hooks/useBorrowings';
import { useFavorites } from '../../hooks/useFavorites';
import { resolveCoverImageUrl } from '../../lib/storageHelper';
import type { Book } from '../../types/book';

interface UserBookCardProps {
  book: Book;
  onBorrowSuccess?: () => void;
}

export const UserBookCard = ({ book, onBorrowSuccess }: UserBookCardProps) => {
  const { user } = useAuth();
  const { borrowBook, hasUserBorrowedBook } = useBorrowings();
  const { favoriteBook, unfavoriteBook, isBookFavorited } = useFavorites();
  const [isBorrowed, setIsBorrowed] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

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

  const handleBorrow = async () => {
    if (!user) return;
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
          : '借阅成功！可以在“我的借阅”中查看详情。';

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
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col w-full h-full">
      {/* 封面区域 - 书本比例 3:4 */}
      <Link to={`/user/books/${book.id}`} className="block aspect-[3/4] bg-gray-200 overflow-hidden flex-shrink-0 relative">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={book.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // 如果图片加载失败，显示占位符
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const placeholder = target.nextElementSibling as HTMLElement;
              if (placeholder) placeholder.style.display = 'flex';
            }}
          />
        ) : null}
        <div className={`absolute inset-0 w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 ${coverImageUrl ? 'hidden' : ''}`}>
          <span className="text-4xl">📖</span>
        </div>
      </Link>
      {/* 内容区域 */}
      <div className="p-4 flex-1 flex flex-col">
        <Link to={`/user/books/${book.id}`}>
          <h3 className="font-bold text-lg text-gray-900 hover:text-blue-600 transition-colors truncate">
            {book.title}
          </h3>
        </Link>
        <p className="text-gray-600 text-sm mt-1 truncate">作者：{book.author}</p>
        {book.category && (
          <p className="text-gray-500 text-xs mt-1">{book.category}</p>
        )}
        <p className={`text-sm mt-2 ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
          可借：{book.available_quantity}/{book.quantity}
        </p>

        {/* 按钮区域 - 自动推到底部 */}
        <div className="mt-auto pt-4 flex gap-2">
          <button
            onClick={handleBorrow}
            disabled={!isAvailable || isBorrowed || loading}
            className={`flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
              !isAvailable || isBorrowed
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isBorrowed ? '已借阅' : isAvailable ? '立即借阅' : '库存不足'}
          </button>
          <button
            onClick={handleToggleFavorite}
            disabled={loading}
            className={`px-3 py-2 rounded-lg transition-colors ${
              isFavorite
                ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isFavorite ? '取消收藏' : '收藏'}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
        </div>
      </div>
    </div>
  );
};
