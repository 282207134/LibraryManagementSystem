import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Review, ReviewWithUser, BookRatingStats } from '../types/review';

export const useReviews = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 获取图书的所有评论
  const getReviews = useCallback(async (bookId: string): Promise<ReviewWithUser[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('reviews')
        .select('*')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // 获取用户信息
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((review: Review) => review.user_id))];
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email, full_name')
          .in('id', userIds);

        const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));

        return data.map((review: Review) => {
          const user = usersMap.get(review.user_id);
          return {
            ...review,
            user_email: user?.email,
            user_full_name: user?.full_name,
          };
        });
      }

      return [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取评论失败';
      setError(errorMessage);
      console.error('获取评论失败:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取用户的评论
  const getUserReview = useCallback(async (bookId: string, userId: string): Promise<Review | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('reviews')
        .select('*')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      return data;
    } catch (err) {
      console.error('获取用户评论失败:', err);
      return null;
    }
  }, []);

  // 创建或更新评论
  const submitReview = useCallback(async (
    bookId: string,
    userId: string,
    rating: number,
    comment?: string
  ): Promise<Review | null> => {
    try {
      setLoading(true);
      setError(null);

      // 检查是否已存在评论
      const existingReview = await getUserReview(bookId, userId);

      let data, reviewError;

      if (existingReview) {
        // 更新现有评论
        const { data: updatedData, error: updateError } = await supabase
          .from('reviews')
          .update({
            rating,
            comment: comment || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingReview.id)
          .select()
          .single();

        data = updatedData;
        reviewError = updateError;
      } else {
        // 创建新评论
        const { data: insertedData, error: insertError } = await supabase
          .from('reviews')
          .insert({
            book_id: bookId,
            user_id: userId,
            rating,
            comment: comment || null,
          })
          .select()
          .single();

        data = insertedData;
        reviewError = insertError;
      }

      if (reviewError) throw reviewError;
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '提交评论失败';
      setError(errorMessage);
      console.error('提交评论失败:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getUserReview]);

  // 删除评论
  const deleteReview = useCallback(async (reviewId: string, userId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', userId); // 确保只能删除自己的评论

      if (deleteError) throw deleteError;
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除评论失败';
      setError(errorMessage);
      console.error('删除评论失败:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取图书的评分统计
  const getBookRatingStats = useCallback(async (bookId: string): Promise<BookRatingStats | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('reviews')
        .select('rating')
        .eq('book_id', bookId);

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        return {
          average_rating: 0,
          total_reviews: 0,
          rating_distribution: [],
        };
      }

      const total = data.length;
      const sum = data.reduce((acc, review) => acc + review.rating, 0);
      const average = sum / total;

      // 计算评分分布
      const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      data.forEach((review) => {
        distribution[review.rating as keyof typeof distribution]++;
      });

      return {
        average_rating: Math.round(average * 10) / 10, // 保留一位小数
        total_reviews: total,
        rating_distribution: [1, 2, 3, 4, 5].map((rating) => ({
          rating,
          count: distribution[rating] || 0,
        })),
      };
    } catch (err) {
      console.error('获取评分统计失败:', err);
      return null;
    }
  }, []);

  return {
    loading,
    error,
    getReviews,
    getUserReview,
    submitReview,
    deleteReview,
    getBookRatingStats,
  };
};

