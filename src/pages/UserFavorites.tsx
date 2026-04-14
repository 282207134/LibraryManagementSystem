import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import { resolveCoverImageUrl } from '../lib/storageHelper';
import { useLanguage } from '../contexts/LanguageContext';
import type { BookFavorite } from '../types/favorite';

// 封面图片组件
const FavoriteBookCover = ({ coverUrl, title }: { coverUrl?: string | null; title: string }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (coverUrl) {
      resolveCoverImageUrl(coverUrl).then(setImageUrl);
    } else {
      setImageUrl(null);
    }
  }, [coverUrl]);

  return (
    <>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const placeholder = target.nextElementSibling as HTMLElement;
            if (placeholder) placeholder.style.display = 'flex';
          }}
        />
      ) : null}
      <div className={`absolute inset-0 w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 ${imageUrl ? 'hidden' : ''}`}>
        <span className="text-4xl">📖</span>
      </div>
    </>
  );
};

export const UserFavorites = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const textMap = {
    zh: {
      loading: '加载中...',
      title: '我的收藏',
      subtitle: '收藏的图书会保存在这里',
      empty: '暂无收藏的图书',
      browse: '去浏览图书',
      unknownBook: '未知图书',
      unknown: '未知',
      author: '作者',
      favoritedAt: '收藏时间',
      view: '查看详情',
      remove: '取消收藏',
    },
    en: {
      loading: 'Loading...',
      title: 'My Favorites',
      subtitle: 'Your saved books will appear here',
      empty: 'No favorite books yet',
      browse: 'Browse books',
      unknownBook: 'Unknown book',
      unknown: 'Unknown',
      author: 'Author',
      favoritedAt: 'Favorited At',
      view: 'View Details',
      remove: 'Remove',
    },
    ja: {
      loading: '読み込み中...',
      title: 'お気に入り',
      subtitle: 'お気に入りに追加した図書がここに表示されます',
      empty: 'お気に入りの図書はまだありません',
      browse: '図書を探す',
      unknownBook: '不明な図書',
      unknown: '不明',
      author: '著者',
      favoritedAt: 'お気に入り日時',
      view: '詳細を見る',
      remove: 'お気に入り解除',
    },
  } as const;
  const t = textMap[language];
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
    return <p className="text-center text-gray-500">{t.loading}</p>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">{t.title}</h1>
        <p className="text-gray-300">{t.subtitle}</p>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">{t.empty}</p>
          <Link
            to="/user/home"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {t.browse} →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <Link to={`/user/books/${favorite.book_id}`} className="block aspect-3/4 bg-gray-200 overflow-hidden relative">
                <FavoriteBookCover coverUrl={favorite.books?.cover_image_url} title={favorite.books?.title || t.unknownBook} />
              </Link>
              <div className="p-4">
                <Link to={`/user/books/${favorite.book_id}`}>
                  <h3 className="font-bold text-lg text-gray-900 hover:text-blue-600 transition-colors truncate">
                    {favorite.books?.title || t.unknownBook}
                  </h3>
                </Link>
                <p className="text-gray-600 text-sm mt-1 truncate">
                  {t.author}: {favorite.books?.author || t.unknown}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  {t.favoritedAt}: {new Date(favorite.favorited_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US')}
                </p>
                <div className="mt-4 flex justify-between items-center">
                  <Link
                    to={`/user/books/${favorite.book_id}`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {t.view}
                  </Link>
                  <button
                    onClick={() => handleRemove(favorite.book_id)}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    {t.remove}
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
