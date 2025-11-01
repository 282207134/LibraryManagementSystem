import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { uploadBookCover, deleteBookCover } from '../lib/storageHelper';
import type { Book, BookFormData } from '../types/book';

const PAGE_SIZE = 10;

type LoadOptions = {
  search: string;
  page: number;
  append: boolean;
};

export const useBooks = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [hasMore, setHasMore] = useState<boolean>(true);

  const loadBooks = useCallback(async ({ search, page, append }: LoadOptions) => {
    setLoading(true);
    setError(null);

    const safePage = Math.max(page, 1);
    const from = append ? (safePage - 1) * PAGE_SIZE : 0;
    const to = append ? from + PAGE_SIZE - 1 : safePage * PAGE_SIZE - 1;

    try {
      let query = supabase
        .from('books')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search) {
        query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      if (data) {
        if (append) {
          setBooks((prev) => {
            const existingIds = new Set(prev.map((book) => book.id));
            const filtered = data.filter((book) => !existingIds.has(book.id));
            return [...prev, ...filtered];
          });
        } else {
          setBooks(data);
        }
      } else if (!append) {
        setBooks([]);
      }

      if (typeof count === 'number') {
        setHasMore(to + 1 < count);
      } else {
        const expectedLength = append ? PAGE_SIZE : safePage * PAGE_SIZE;
        setHasMore(Boolean(data && data.length === expectedLength));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const initialize = useCallback(async () => {
    setPage(1);
    setSearchTerm('');
    await loadBooks({ search: '', page: 1, append: false });
  }, [loadBooks]);

  const searchBooks = useCallback(async (term: string) => {
    const normalizedTerm = term.trim();
    setSearchTerm(normalizedTerm);
    setPage(1);
    await loadBooks({ search: normalizedTerm, page: 1, append: false });
  }, [loadBooks]);

  const refresh = useCallback(async () => {
    await loadBooks({ search: searchTerm, page, append: false });
  }, [loadBooks, page, searchTerm]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    await loadBooks({ search: searchTerm, page: nextPage, append: true });
    setPage(nextPage);
  }, [loading, hasMore, page, searchTerm, loadBooks]);

  const addBook = useCallback(async (bookData: BookFormData): Promise<Book | null> => {
    if (bookData.available_quantity > bookData.quantity) {
      setError('可借数量不能大于库存数量');
      return null;
    }

    let uploadedCoverPath: string | null = null;

    try {
      setError(null);

      let coverImageUrl = bookData.cover_image_url ?? null;

      if (bookData.cover_image_file) {
        const uploadResult = await uploadBookCover(bookData.cover_image_file);
        if (uploadResult.error) {
          setError(`图片上传失败: ${uploadResult.error}`);
          return null;
        }
        coverImageUrl = uploadResult.path ?? uploadResult.url;
        uploadedCoverPath = uploadResult.path;
      }

      const payload: Record<string, unknown> = {
        ...bookData,
        cover_image_url: coverImageUrl ?? null,
        available_quantity: Math.min(bookData.available_quantity, bookData.quantity),
      };

      delete payload.cover_image_file;
      delete payload.remove_cover;

      const { data, error } = await supabase
        .from('books')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      await refresh();
      return data ?? null;
    } catch (err) {
      if (uploadedCoverPath) {
        await deleteBookCover(uploadedCoverPath);
      }
      setError(err instanceof Error ? err.message : '添加图书时发生错误');
      return null;
    }
  }, [refresh]);

  const updateBook = useCallback(async (id: string, bookData: Partial<BookFormData>): Promise<Book | null> => {
    if (
      typeof bookData.available_quantity === 'number' &&
      typeof bookData.quantity === 'number' &&
      bookData.available_quantity > bookData.quantity
    ) {
      setError('可借数量不能大于库存数量');
      return null;
    }

    const existingBook = books.find((item) => item.id === id);
    let uploadedCoverPath: string | null = null;

    try {
      setError(null);

      let nextCoverUrl = bookData.cover_image_url ?? existingBook?.cover_image_url ?? null;

      if (bookData.cover_image_file) {
        const uploadResult = await uploadBookCover(bookData.cover_image_file);
        if (uploadResult.error) {
          setError(`图片上传失败: ${uploadResult.error}`);
          return null;
        }
        nextCoverUrl = uploadResult.path ?? uploadResult.url ?? null;
        uploadedCoverPath = uploadResult.path;
      } else if (bookData.remove_cover) {
        nextCoverUrl = null;
      }

      const payload: Record<string, unknown> = {
        ...bookData,
        cover_image_url: nextCoverUrl,
        updated_at: new Date().toISOString(),
      };

      delete payload.cover_image_file;
      delete payload.remove_cover;

      if (typeof bookData.available_quantity === 'number' && typeof bookData.quantity === 'number') {
        payload.available_quantity = Math.min(bookData.available_quantity, bookData.quantity);
      }

      const { data, error } = await supabase
        .from('books')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (existingBook?.cover_image_url && existingBook.cover_image_url !== data.cover_image_url) {
        await deleteBookCover(existingBook.cover_image_url);
      }

      await refresh();
      return data ?? null;
    } catch (err) {
      if (uploadedCoverPath) {
        await deleteBookCover(uploadedCoverPath);
      }
      setError(err instanceof Error ? err.message : '更新图书时发生错误');
      return null;
    }
  }, [refresh, books]);

  const deleteBook = useCallback(async (id: string): Promise<boolean> => {
    const bookToDelete = books.find((item) => item.id === id);

    try {
      setError(null);
      const { error } = await supabase.from('books').delete().eq('id', id);

      if (error) throw error;

      if (bookToDelete?.cover_image_url) {
        await deleteBookCover(bookToDelete.cover_image_url);
      }

      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除图书时发生错误');
      return false;
    }
  }, [refresh, books]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    books,
    loading,
    error,
    hasMore,
    searchTerm,
    searchBooks,
    loadMore,
    refresh,
    addBook,
    updateBook,
    deleteBook,
  };
};
