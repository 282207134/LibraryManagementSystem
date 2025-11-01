import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { BorrowingRecord } from '../types/borrowing';

interface BorrowResult {
  success: boolean;
  error?: string;
  due_date?: string;
}

export function useBorrowings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 借阅图书
  const borrowBook = useCallback(async (bookId: string, userId: string): Promise<BorrowResult> => {
    setLoading(true);
    setError(null);

    try {
      // 调用数据库函数进行借阅
      const { data, error: rpcError } = await supabase.rpc('borrow_book', {
        p_user_id: userId,
        p_book_id: bookId,
      });

      if (rpcError) {
        const errorMessage = rpcError.message || '借阅失败';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      if (data && !data.success) {
        setError(data.error || '借阅失败');
        return { success: false, error: data.error };
      }

      return { success: true, due_date: data?.due_date };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '借阅失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // 归还图书
  const returnBook = useCallback(async (borrowingId: string): Promise<BorrowResult> => {
    setLoading(true);
    setError(null);

    try {
      // 调用数据库函数进行归还
      const { data, error: rpcError } = await supabase.rpc('return_book', {
        p_borrowing_id: borrowingId,
      });

      if (rpcError) {
        const errorMessage = rpcError.message || '归还失败';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      if (data && !data.success) {
        setError(data.error || '归还失败');
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '归还失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取用户的借阅记录
  const getUserBorrowings = useCallback(async (userId: string): Promise<BorrowingRecord[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('borrowing_records')
        .select(`
          *,
          books (
            id,
            title,
            author,
            cover_image_url
          )
        `)
        .eq('user_id', userId)
        .order('borrowed_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return [];
      }

      return (data || []) as BorrowingRecord[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取借阅记录失败';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取当前借阅中的图书
  const getCurrentBorrowings = useCallback(async (userId: string): Promise<BorrowingRecord[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('borrowing_records')
        .select(`
          *,
          books (
            id,
            title,
            author,
            cover_image_url
          )
        `)
        .eq('user_id', userId)
        .in('status', ['borrowed', 'overdue'])
        .order('borrowed_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return [];
      }

      return (data || []) as BorrowingRecord[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取借阅记录失败';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 检查用户是否已借阅某本书
  const hasUserBorrowedBook = useCallback(async (userId: string, bookId: string): Promise<boolean> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('borrowing_records')
        .select('id')
        .eq('user_id', userId)
        .eq('book_id', bookId)
        .eq('status', 'borrowed')
        .maybeSingle();

      if (fetchError) {
        console.error('检查借阅状态失败:', fetchError);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('检查借阅状态时发生错误:', err);
      return false;
    }
  }, []);

  return {
    loading,
    error,
    borrowBook,
    returnBook,
    getUserBorrowings,
    getCurrentBorrowings,
    hasUserBorrowedBook,
  };
}
