import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { BorrowingRecord } from '../types/borrowing';

interface BorrowResult {
  success: boolean;
  error?: string;
  due_date?: string;
}

const DEFAULT_BORROW_DAYS = 30;

export function useBorrowings() {
  // 借阅模块统一状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 借阅图书
  const borrowBook = useCallback(async (bookId: string, userId: string, days: number = DEFAULT_BORROW_DAYS): Promise<BorrowResult> => {
    setLoading(true);
    setError(null);

    try {
      // 借阅逻辑放在数据库函数里，前端仅做参数传递和结果处理
      const { data, error: rpcError } = await supabase.rpc('borrow_book', {
        p_book_id: bookId,
        p_user_id: userId,
        p_days: days,
      });

      if (rpcError) {
        const errorMessage = rpcError.message || '借阅失败，请稍后重试';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // 防御式校验：避免后端返回空结果导致前端误判成功
      if (!data) {
        const errorMessage = '借阅失败：未收到服务器响应';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // 兼容多种返回形态：success=false 或仅返回 error
      if (data.success === false || (data.success !== true && data.error)) {
        const errorMessage = data.error || '借阅失败，请稍后重试';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // 明确 success=true 才认定成功
      if (data.success === true) {
        return { success: true, due_date: data.due_date };
      }

      // 未命中成功分支时统一按失败处理
      const errorMessage = data.error || '借阅失败：未知错误';
      setError(errorMessage);
      return { success: false, error: errorMessage };
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
      // 归还同样走数据库函数，保证库存/状态变更原子性
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
      // 联表拉取图书信息，减少前端二次查询
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
      // 仅筛选当前仍在借阅中的记录（borrowed / overdue）
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
      // 轻量查询：只关心是否存在记录
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

  // 管理员：获取所有借阅记录（不限制用户）
  const getAllBorrowings = useCallback(async (): Promise<BorrowingRecord[]> => {
    setLoading(true);
    setError(null);

    try {
      // 先获取借阅记录（含图书信息）
      const { data: borrowingsData, error: borrowingsError } = await supabase
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
        .order('borrowed_at', { ascending: false });

      if (borrowingsError) {
        setError(borrowingsError.message);
        return [];
      }

      if (!borrowingsData || borrowingsData.length === 0) {
        return [];
      }

      // 提取去重 user_id，进行一次批量查询
      const userIds = [...new Set(borrowingsData.map((r: any) => r.user_id))];

      // 批量查询用户信息
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', userIds);

      if (usersError) {
        console.error('获取用户信息失败:', usersError);
        // 即使获取用户信息失败，也返回借阅记录（不包含用户信息）
        return borrowingsData as BorrowingRecord[];
      }

      // 用 Map 做 O(1) 匹配，避免多重循环
      const usersMap = new Map(
        (usersData || []).map((u) => [u.id, { id: u.id, email: u.email, full_name: u.full_name }])
      );

      // 合并结果供管理员页面展示
      const result = borrowingsData.map((record: any) => ({
        ...record,
        users: usersMap.get(record.user_id) || null,
      }));

      return result as BorrowingRecord[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取借阅记录失败';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
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
    getAllBorrowings,
  };
}
