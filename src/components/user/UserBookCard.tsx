import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBorrowings } from '../../hooks/useBorrowings';
import { useFavorites } from '../../hooks/useFavorites';
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

  useEffect(() => {
    if (user) {
      hasUserBorrowedBook(user.id, book.id).then(setIsBorrowed);
      isBookFavorited(book.id, user.id).then(setIsFavorite);
    }
  }, [user, book.id, hasUserBorrowedBook, isBookFavorited]);

  const handleBorrow = async () => {
    if (!user) return;
    setLoading(true);
    const result = await borrowBook(book.id, user.id);
    setLoading(false);

    if (result.success) {
      alert(`借阅成功！到期日期：${new Date(result.due_date!).toLocaleDateString()}`);
      setIsBorrowed(true);
      onBorrowSuccess?.();
    } else {
      alert(`借阅失败：${result.error}`);
    }
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <Link to={`/user/books/${book.id}`}>
        {book.cover_image_url ? (
          <img
            src={book.cover_image_url}
            alt={book.title}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-400">
            <span className="text-4xl">📖</span>
          </div>
        )}
      </Link>
      <div className="p-4">
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

        <div className="mt-4 flex gap-2">
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
