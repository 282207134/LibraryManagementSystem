import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { errorMessage, normalizePickupCode } from '../lib/borrowing';
import type { BorrowingRecord, BorrowingRequest } from '../types/borrowing';

export interface BorrowResult {
  success: boolean;
  error?: string;
  due_date?: string;
  pickup_code?: string;
  request_id?: string;
  expires_at?: string;
  status?: string;
}

export function useBorrowings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(0);

  const run = useCallback(async <T,>(action: () => Promise<T>, fallback: T): Promise<T> => {
    if (pending.current++ === 0) setError(null);
    setLoading(true);
    try { return await action(); }
    catch (err) { setError(errorMessage(err)); return fallback; }
    finally { if (--pending.current === 0) setLoading(false); }
  }, []);

  const rpc = useCallback(async (name: string, args: Record<string, unknown>): Promise<BorrowResult> =>
    run(async () => {
      const { data, error: rpcError } = await supabase.rpc(name, args);
      if (rpcError) throw rpcError;
      if (data?.success !== true) {
        const message = data?.error || '未收到成功确认，请刷新记录后重试';
        setError(message);
        return { success: false, error: message };
      }
      return data as BorrowResult;
    }, { success: false }), [run]);

  const borrowBook = useCallback(async (bookId: string, _userId: string, days = 30) =>
    rpc('request_borrow_book', { p_book_id: bookId, p_days: days }), [rpc]);
  const approveRequest = useCallback(async (rawCode: string) => {
    const code = normalizePickupCode(rawCode);
    if (!code) return { success: false, error: '请输入 8 位数字码' };
    return rpc('approve_borrow_request', { p_code: code });
  }, [rpc]);
  const closeRequest = useCallback(async (id: string, action: 'cancelled' | 'rejected', note?: string) =>
    rpc('close_borrow_request', { p_request_id: id, p_action: action, p_note: note ?? null }), [rpc]);
  const returnBook = useCallback(async (id: string) => rpc('return_book', { p_borrowing_id: id }), [rpc]);

  const getUserBorrowings = useCallback(async (userId: string): Promise<BorrowingRecord[]> => run(async () => {
    const { data, error: fetchError } = await supabase.from('borrowing_records')
      .select('*, books(id,title,author,cover_image_url)').eq('user_id', userId)
      .order('borrowed_at', { ascending: false });
    if (fetchError) throw fetchError;
    return (data || []) as BorrowingRecord[];
  }, []), [run]);
  const getRequests = useCallback(async (userId?: string): Promise<BorrowingRequest[]> => run(async () => {
    let query = supabase.from('borrowing_requests')
      .select('*, books(id,title,author,cover_image_url), users!borrowing_requests_user_id_fkey(id,email,full_name)')
      .order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    return (data || []) as BorrowingRequest[];
  }, []), [run]);
  const getBookBorrowingState = useCallback(async (userId: string, bookId: string): Promise<'pending' | 'borrowed' | null> => {
    const [{ data: loans, error: loanError }, { data: requests, error: requestError }] = await Promise.all([
      supabase.from('borrowing_records').select('id').eq('user_id', userId).eq('book_id', bookId)
        .in('status', ['borrowed', 'overdue']).limit(1),
      supabase.from('borrowing_requests').select('id').eq('user_id', userId).eq('book_id', bookId)
        .eq('status', 'pending').gt('expires_at', new Date().toISOString()).limit(1),
    ]);
    if (loanError || requestError) throw loanError || requestError;
    return loans?.length ? 'borrowed' : requests?.length ? 'pending' : null;
  }, []);
  const getAllBorrowings = useCallback(async (): Promise<BorrowingRecord[]> => run(async () => {
    const { data, error: fetchError } = await supabase.from('borrowing_records')
      .select('*, books(id,title,author,cover_image_url)').order('borrowed_at', { ascending: false });
    if (fetchError) throw fetchError;
    const records = (data || []) as BorrowingRecord[];
    if (!records.length) return [];
    const { data: users, error: usersError } = await supabase.from('users')
      .select('id,email,full_name').in('id', [...new Set(records.map(record => record.user_id))]);
    if (usersError) throw usersError;
    const byId = new Map((users || []).map(user => [user.id, user]));
    return records.map(record => ({ ...record, users: byId.get(record.user_id) }));
  }, []), [run]);

  return { loading, error, borrowBook, returnBook, approveRequest, closeRequest,
    getUserBorrowings, getAllBorrowings, getRequests, getBookBorrowingState };
}
