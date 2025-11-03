import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBorrowings } from '../hooks/useBorrowings';
import { useFavorites } from '../hooks/useFavorites';
import { useReviews } from '../hooks/useReviews';
import { resolveCoverImageUrl } from '../lib/storageHelper';
import { supabase } from '../lib/supabaseClient';
import { StarRating } from '../components/StarRating';
import type { Book } from '../types/book';
import type { Review, ReviewWithUser, BookRatingStats } from '../types/review';

export const UserBookDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { borrowBook, hasUserBorrowedBook } = useBorrowings();
  const { favoriteBook, unfavoriteBook, isBookFavorited } = useFavorites();
  const { getReviews, getUserReview, submitReview, deleteReview, getBookRatingStats } = useReviews();
  
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBorrowed, setIsBorrowed] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  
  // 评论相关状态
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [ratingStats, setRatingStats] = useState<BookRatingStats | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);

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
          
          // 加载用户的评论
          const review = await getUserReview(id, user.id);
          setUserReview(review);
          if (review) {
            setSelectedRating(review.rating);
            setComment(review.comment || '');
          }
        }
        
        // 加载所有评论和评分统计
        await loadReviewsAndStats(id);
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

  const loadReviewsAndStats = async (bookId: string) => {
    setReviewLoading(true);
    try {
      const [reviewsData, statsData] = await Promise.all([
        getReviews(bookId),
        getBookRatingStats(bookId),
      ]);
      setReviews(reviewsData);
      setRatingStats(statsData);
    } catch (err) {
      console.error('加载评论失败:', err);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !id || selectedRating === 0) return;
    
    setReviewLoading(true);
    const review = await submitReview(id, user.id, selectedRating, comment);
    
    if (review) {
      setUserReview(review);
      setShowReviewForm(false);
      await loadReviewsAndStats(id);
    }
    setReviewLoading(false);
  };

  const handleDeleteReview = async () => {
    if (!userReview || !user) return;
    
    if (window.confirm('确定要删除这条评论吗？')) {
      setReviewLoading(true);
      const success = await deleteReview(userReview.id, user.id);
      
      if (success) {
        setUserReview(null);
        setSelectedRating(0);
        setComment('');
        await loadReviewsAndStats(id);
      }
      setReviewLoading(false);
    }
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
              <div className="border-t pt-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3">图书简介</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {book.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 评论和评分区域 */}
        <div className="border-t p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">评论与评分</h2>
            
            {/* 评分统计 */}
            {ratingStats && ratingStats.total_reviews > 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4 mb-2">
                  <StarRating rating={ratingStats.average_rating} readonly showText size="lg" />
                  <span className="text-gray-600">
                    共 {ratingStats.total_reviews} 条评论
                  </span>
                </div>
              </div>
            )}

            {/* 用户评论表单 */}
            {user && (
              <div className="mb-6">
                {userReview ? (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-gray-900">我的评论</p>
                        <StarRating rating={userReview.rating} readonly size="sm" />
                      </div>
                      <button
                        onClick={handleDeleteReview}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        删除
                      </button>
                    </div>
                    {userReview.comment && (
                      <p className="text-gray-700 mt-2">{userReview.comment}</p>
                    )}
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="mt-3 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      修改评论
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {showReviewForm ? '取消评论' : '添加评论'}
                  </button>
                )}

                {showReviewForm && (
                  <div className="mt-4 p-4 border rounded-lg">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        评分
                      </label>
                      <StarRating
                        rating={selectedRating}
                        onRatingChange={setSelectedRating}
                        size="lg"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        评论内容（可选）
                      </label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="分享你的阅读体验..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSubmitReview}
                        disabled={reviewLoading || selectedRating === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {reviewLoading ? '提交中...' : '提交评论'}
                      </button>
                      {userReview && (
                        <button
                          onClick={() => {
                            setShowReviewForm(false);
                            setSelectedRating(userReview.rating);
                            setComment(userReview.comment || '');
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 评论列表 */}
            <div className="mt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                所有评论 ({reviews.length})
              </h3>
              {reviewLoading ? (
                <p className="text-gray-500">加载中...</p>
              ) : reviews.length === 0 ? (
                <p className="text-gray-500">暂无评论，快来第一个评论吧！</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {review.user_full_name || review.user_email || '匿名用户'}
                          </p>
                          <StarRating rating={review.rating} readonly size="sm" />
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(review.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-gray-700 mt-2">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

