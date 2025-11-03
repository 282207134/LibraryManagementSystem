import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Book } from '../types/book';

export interface BookWithStats extends Book {
  borrow_count?: number;
  average_rating?: number;
  review_count?: number;
}

export const useHomeData = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取高评分推荐图书（平均评分 >= 4.0，随机排序）
  const getRecommendedBooks = useCallback(async (limit: number = 10): Promise<BookWithStats[]> => {
    try {
      setLoading(true);
      setError(null);

      // 先获取有评分的图书及其平均分
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('book_id, rating');

      if (reviewsError) throw reviewsError;

      // 计算每本书的平均评分
      const bookRatings = new Map<string, { sum: number; count: number }>();
      reviewsData?.forEach((review) => {
        const existing = bookRatings.get(review.book_id) || { sum: 0, count: 0 };
        bookRatings.set(review.book_id, {
          sum: existing.sum + review.rating,
          count: existing.count + 1,
        });
      });

      // 筛选平均分 >= 4.0 的图书
      const highRatedBookIds: string[] = [];
      bookRatings.forEach((stats, bookId) => {
        const avgRating = stats.sum / stats.count;
        if (avgRating >= 4.0) {
          highRatedBookIds.push(bookId);
        }
      });

      if (highRatedBookIds.length === 0) {
        // 如果没有高评分图书，返回所有有评分的图书
        bookRatings.forEach((_, bookId) => {
          highRatedBookIds.push(bookId);
        });
      }

      // 随机打乱并取前 limit 个
      const shuffled = highRatedBookIds.sort(() => Math.random() - 0.5).slice(0, limit);

      if (shuffled.length === 0) {
        // 如果还是没有，返回最近添加的图书
        const { data: booksData } = await supabase
          .from('books')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        return booksData || [];
      }

      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select('*')
        .in('id', shuffled);

      if (booksError) throw booksError;

      // 添加评分信息
      return (booksData || []).map((book) => {
        const ratingStats = bookRatings.get(book.id);
        const avgRating = ratingStats ? ratingStats.sum / ratingStats.count : 0;
        return {
          ...book,
          average_rating: Math.round(avgRating * 10) / 10,
          review_count: ratingStats?.count || 0,
        };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取推荐图书失败';
      setError(errorMessage);
      console.error('获取推荐图书失败:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取人气排行榜（按借阅次数排序）
  const getPopularBooks = useCallback(async (limit: number = 10): Promise<BookWithStats[]> => {
    try {
      setLoading(true);
      setError(null);

      // 统计每本书的借阅次数
      const { data: borrowData, error: borrowError } = await supabase
        .from('borrowing_records')
        .select('book_id');

      if (borrowError) throw borrowError;

      const borrowCounts = new Map<string, number>();
      borrowData?.forEach((record) => {
        const count = borrowCounts.get(record.book_id) || 0;
        borrowCounts.set(record.book_id, count + 1);
      });

      // 获取图书信息
      const { data: allBooks, error: booksError } = await supabase
        .from('books')
        .select('*');

      if (booksError) throw booksError;

      // 添加借阅次数并排序
      const booksWithCounts = (allBooks || [])
        .map((book) => ({
          ...book,
          borrow_count: borrowCounts.get(book.id) || 0,
        }))
        .sort((a, b) => b.borrow_count - a.borrow_count)
        .slice(0, limit);

      return booksWithCounts;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取人气图书失败';
      setError(errorMessage);
      console.error('获取人气图书失败:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取新上架图书
  const getNewBooks = useCallback(async (limit: number = 10): Promise<Book[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取新上架图书失败';
      setError(errorMessage);
      console.error('获取新上架图书失败:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取所有分类
  const getCategories = useCallback(async (): Promise<string[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('books')
        .select('category')
        .not('category', 'is', null);

      if (fetchError) throw fetchError;

      const categories = [...new Set((data || []).map((book) => book.category).filter(Boolean))];
      return categories.sort();
    } catch (err) {
      console.error('获取分类失败:', err);
      return [];
    }
  }, []);

  // 按分类获取图书
  const getBooksByCategory = useCallback(async (category: string, limit: number = 20): Promise<Book[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('books')
        .select('*')
        .eq('category', category)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取分类图书失败';
      setError(errorMessage);
      console.error('获取分类图书失败:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getRecommendedBooks,
    getPopularBooks,
    getNewBooks,
    getCategories,
    getBooksByCategory,
  };
};

