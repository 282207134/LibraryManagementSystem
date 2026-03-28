import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { uploadBookCover, deleteBookCover } from '../lib/storageHelper';
import type { Book, BookFormData } from '../types/book';

const PAGE_SIZE = 10;

type LoadOptions = {
  search: string;
  page: number;
};

export const useBooks = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const totalPages = useMemo(() => {
    if (totalCount === null || totalCount === 0) return 1;
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [totalCount]);

  const loadBooks = useCallback(async ({ search, page: pageArg }: LoadOptions): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const safePage = Math.max(pageArg, 1);
    const from = (safePage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      let countQuery = supabase.from('books').select('*', { count: 'exact', head: true });

      if (search) {
        countQuery = countQuery.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
      }

      const { count } = await countQuery;

      const queryCount = typeof count === 'number' ? count : 0;
      setTotalCount(queryCount);

      let query = supabase
        .from('books')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);

      if (search) {
        query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      if (data) {
        setBooks(data);
      } else {
        setBooks([]);
      }
      return true;
    } catch (err) {
      console.error('[loadBooks] 错误:', err);
      setError(err instanceof Error ? err.message : '发生未知错误');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const initialize = useCallback(async () => {
    const ok = await loadBooks({ search: '', page: 1 });
    if (ok) {
      setPage(1);
      setSearchTerm('');
    }
  }, [loadBooks]);

  const searchBooks = useCallback(
    async (term: string) => {
      const normalizedTerm = term.trim();
      const ok = await loadBooks({ search: normalizedTerm, page: 1 });
      if (ok) {
        setSearchTerm(normalizedTerm);
        setPage(1);
      }
    },
    [loadBooks]
  );

  const refresh = useCallback(async () => {
    await loadBooks({ search: searchTerm, page });
  }, [loadBooks, page, searchTerm]);

  const goToPage = useCallback(
    async (nextPage: number) => {
      if (loading || totalCount === null) return;
      const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      const clamped = Math.min(Math.max(1, nextPage), maxPage);
      if (clamped === page) return;
      const ok = await loadBooks({ search: searchTerm, page: clamped });
      if (ok) setPage(clamped);
    },
    [loading, totalCount, page, searchTerm, loadBooks]
  );

  const addBook = useCallback(
    async (bookData: BookFormData): Promise<Book | null> => {
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
          available_quantity: bookData.quantity,
        };

        delete payload.cover_image_file;
        delete payload.remove_cover;

        const { data, error } = await supabase.from('books').insert([payload]).select().single();

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
    },
    [refresh]
  );

  const updateBook = useCallback(
    async (id: string, bookData: Partial<BookFormData>): Promise<Book | null> => {
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
        delete payload.available_quantity;

        const { data, error } = await supabase.from('books').update(payload).eq('id', id).select().single();

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
    },
    [refresh, books]
  );

  const deleteBook = useCallback(
    async (id: string): Promise<boolean> => {
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
    },
    [refresh, books]
  );

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    books,
    loading,
    error,
    page,
    totalPages,
    totalCount,
    searchTerm,
    searchBooks,
    goToPage,
    refresh,
    addBook,
    updateBook,
    deleteBook,
  };
};
