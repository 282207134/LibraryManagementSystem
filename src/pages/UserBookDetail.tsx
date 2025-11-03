import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBorrowings } from '../hooks/useBorrowings';
import { useFavorites } from '../hooks/useFavorites';
import { resolveCoverImageUrl } from '../lib/storageHelper';
import { supabase } from '../lib/supabaseClient';
import type { Book } from '../types/book';

export const UserBookDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { borrowBook, hasUserBorrowedBook } = useBorrowings();
  const { favoriteBook, unfavoriteBook, isBookFavorited } = useFavorites();
  
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBorrowed, setIsBorrowed] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('图书ID无效');
      setLoading(false);
      return;
    }

    const loadBook = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('books')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          setError('图书不存在');
          setBook(null);
          return;
        }

        setBook(data);
        
        // 加载封面图片
        if (data.cover_image_url) {
          const resolvedUrl = await resolveCoverImageUrl(data.cover_image_url);
          setCoverImageUrl(resolvedUrl);
        }

        // 检查借阅和收藏状态
        if (user) {
          const borrowed = await hasUserBorrowedBook(user.id, id);
          const favorited = await isBookFavorited(id, user.id);
          setIsBorrowed(borrowed);
          setIsFavorite(favorited);
        }
      } catch (err) {
        console.error('加载图书详情失败', err);
        setError(err instanceof Error ? err.message : '加载图书详情失败');
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [id, user, hasUserBorrowedBook, isBookFavorited]);

  const handleBorrow = async () => {
    if (!user || !id) return;
    
    setBorrowLoading(true);
    const result = await borrowBook(id, user.id);
    setBorrowLoading(false);

    if (result.success) {
      alert(`借阅成功！到期日期：${result.due_date ? new Date(result.due_date).toLocaleDateString() : '30天后'}`);
      setIsBorrowed(true);
      
      // 重新加载图书信息以更新可借数量
      const { data } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (data) {
        setBook(data);
      }
    } else {
      alert(`借阅失败：${result.error || '未知错误'}`);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user || !id) return;
    
    setBorrowLoading(true);
    
    if (isFavorite) {
      const success = await unfavoriteBook(id, user.id);
      if (success) {
        setIsFavorite(false);
      }
    } else {
      const success = await favoriteBook(id, user.id);
      if (success) {
        setIsFavorite(true);
      }
    }
    
    setBorrowLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || '图书不存在'}</p>
        <Link
          to="/user/home"
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          返回图书列表
        </Link>
      </div>
    );
  }

  const isAvailable = book.available_quantity > 0;

  return (
    <div>
      {/* 返回按钮 */}
      <Link
        to="/user/home"
        className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6"
      >
        <span className="mr-2">←</span>
        返回图书列表
      </Link>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="flex flex-col md:flex-row md:min-h-[600px]">
          {/* 封面区域 */}
          <div className="md:w-1/3 bg-gray-50 relative overflow-hidden">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt={book.title}
                className="w-full h-full object-cover absolute inset-0"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const placeholder = target.nextElementSibling as HTMLElement;
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
            ) : null}
            <div className={`w-full h-full min-h-[400px] md:min-h-[600px] bg-gray-200 flex items-center justify-center text-gray-400 ${coverImageUrl ? 'hidden' : ''}`}>
              <span className="text-6xl">📖</span>
            </div>
          </div>

          {/* 详细信息区域 */}
          <div className="md:w-2/3 p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{book.title}</h1>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center">
                <span className="text-gray-600 font-medium w-24">作者：</span>
                <span className="text-gray-900">{book.author}</span>
              </div>
              
              {book.isbn && (
                <div className="flex items-center">
                  <span className="text-gray-600 font-medium w-24">ISBN：</span>
                  <span className="text-gray-900">{book.isbn}</span>
                </div>
              )}
              
              {book.publisher && (
                <div className="flex items-center">
                  <span className="text-gray-600 font-medium w-24">出版社：</span>
                  <span className="text-gray-900">{book.publisher}</span>
                </div>
              )}
              
              {book.publication_year && (
                <div className="flex items-center">
                  <span className="text-gray-600 font-medium w-24">出版年份：</span>
                  <span className="text-gray-900">{book.publication_year}</span>
                </div>
              )}
              
              {book.category && (
                <div className="flex items-center">
                  <span className="text-gray-600 font-medium w-24">分类：</span>
                  <span className="text-gray-900">{book.category}</span>
                </div>
              )}
              
              <div className="flex items-center">
                <span className="text-gray-600 font-medium w-24">库存状态：</span>
                <span className={`font-medium ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                  可借：{book.available_quantity}/{book.quantity}
                </span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={handleBorrow}
                disabled={!isAvailable || isBorrowed || borrowLoading || !user}
                className={`px-6 py-3 rounded-lg text-white font-medium transition-colors ${
                  !isAvailable || isBorrowed || !user
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {!user 
                  ? '请先登录' 
                  : isBorrowed 
                    ? '已借阅' 
                    : isAvailable 
                      ? '立即借阅' 
                      : '库存不足'}
              </button>
              
              {user && (
                <button
                  onClick={handleToggleFavorite}
                  disabled={borrowLoading}
                  className={`px-6 py-3 rounded-lg transition-colors ${
                    isFavorite
                      ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="mr-2">{isFavorite ? '⭐' : '☆'}</span>
                  {isFavorite ? '已收藏' : '收藏'}
                </button>
              )}
            </div>

            {/* 图书简介 */}
            {book.description && (
              <div className="border-t pt-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3">图书简介</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {book.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

