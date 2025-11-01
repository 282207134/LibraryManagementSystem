import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import type { BookFavorite } from '../types/favorite';

export const UserFavorites = () => {
  const { user } = useAuth();
  const { getUserFavorites, unfavoriteBook, loading } = useFavorites();
  const [favorites, setFavorites] = useState<BookFavorite[]>([]);

  useEffect(() => {
    if (user) {
      loadFavorites();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadFavorites = async () => {
    if (!user) return;
    const data = await getUserFavorites(user.id);
    setFavorites(data);
  };

  const handleRemove = async (bookId: string) => {
    if (!user) return;
    const success = await unfavoriteBook(bookId, user.id);
    if (success) {
      loadFavorites();
    }
  };

  if (loading && favorites.length === 0) {
    return <p className="text-center text-gray-500">加载中...</p>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">我的收藏</h1>
        <p className="text-gray-600">收藏的图书会保存在这里</p>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">暂无收藏的图书</p>
          <Link
            to="/user/home"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            去浏览图书 →
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <Link to={`/user/books/${favorite.book_id}`}>
                {favorite.books?.cover_image_url ? (
                  <img
                    src={favorite.books.cover_image_url}
                    alt={favorite.books.title}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-400">
                    <span className="text-4xl">📖</span>
                  </div>
                )}
              </Link>
              <div className="p-4">
                <Link to={`/user/books/${favorite.book_id}`}>
                  <h3 className="font-bold text-lg text-gray-900 hover:text-blue-600 transition-colors truncate">
                    {favorite.books?.title || '未知图书'}
                  </h3>
                </Link>
                <p className="text-gray-600 text-sm mt-1 truncate">
                  作者：{favorite.books?.author || '未知'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  收藏时间：{new Date(favorite.favorited_at).toLocaleDateString()}
                </p>
                <div className="mt-4 flex justify-between items-center">
                  <Link
                    to={`/user/books/${favorite.book_id}`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    查看详情
                  </Link>
                  <button
                    onClick={() => handleRemove(favorite.book_id)}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    取消收藏
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
