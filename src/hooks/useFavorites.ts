import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { BookFavorite } from '../types/favorite';

export function useFavorites() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const favoriteBook = useCallback(async (bookId: string, userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('book_favorites')
        .insert({ book_id: bookId, user_id: userId });

      if (insertError) {
        throw new Error(insertError.message);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '收藏失败';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const unfavoriteBook = useCallback(async (bookId: string, userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('book_favorites')
        .delete()
        .eq('book_id', bookId)
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '取消收藏失败';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserFavorites = useCallback(async (userId: string): Promise<BookFavorite[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('book_favorites')
        .select(`
          *,
          books (
            id,
            title,
            author,
            cover_image_url,
            available_quantity
          )
        `)
        .eq('user_id', userId)
        .order('favorited_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return (data || []) as BookFavorite[];
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取收藏失败';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const isBookFavorited = useCallback(async (bookId: string, userId: string): Promise<boolean> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('book_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('book_id', bookId)
        .maybeSingle();

      if (fetchError) {
        console.error('检查收藏状态失败:', fetchError.message);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('检查收藏状态时发生错误:', err);
      return false;
    }
  }, []);

  return {
    loading,
    error,
    favoriteBook,
    unfavoriteBook,
    getUserFavorites,
    isBookFavorited,
  };
}
