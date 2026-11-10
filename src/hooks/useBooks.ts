import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { uploadBookCover, deleteBookCover } from '../lib/storageHelper';
import type { Book, BookFormData } from '../types/book';
import { errorMessage } from '../lib/borrowing';

const PAGE_SIZE = 10;

type LoadOptions = {
  search: string;
  page: number;
};

export const useBooks = () => {
  // 图书模块统一状态：列表、分页、检索、错误与加载态
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const latestRequest = useRef(0);

  const totalPages = useMemo(() => {
    if (totalCount === null || totalCount === 0) return 1;
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [totalCount]);

  // 核心加载函数：先查总数，再按页拉取数据
  const loadBooks = useCallback(async ({ search, page: pageArg }: LoadOptions): Promise<boolean> => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);

    let safePage = Math.max(pageArg, 1);

    try {
      const fetchPage = (target: number) => {
        let query = supabase.from('books').select('*', { count: 'exact' })
          .order('created_at', { ascending: false }).order('id', { ascending: false })
          .range((target - 1) * PAGE_SIZE, target * PAGE_SIZE - 1);
        if (search) {
          // Quote PostgREST values so commas/parentheses in book titles remain text.
          const pattern = `%${search}%`.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          query = query.or(`title.ilike."${pattern}",author.ilike."${pattern}"`);
        }
        return query;
      };
      let result = await fetchPage(safePage);
      if (requestId !== latestRequest.current) return false;
      if (result.error && result.error.code !== 'PGRST103') throw result.error;
      const maxPage = Math.max(1, Math.ceil((result.count ?? 0) / PAGE_SIZE));
      if (safePage > maxPage) {
        safePage = maxPage;
        result = await fetchPage(safePage);
      }
      if (requestId !== latestRequest.current) return false;
      if (result.error) throw result.error;
      setBooks(result.data || []);
      setTotalCount(result.count ?? 0);
      setPage(safePage);
      setSearchTerm(search);
      return true;
    } catch (err) {
      console.error('[loadBooks] 错误:', err);
      if (requestId === latestRequest.current) setError(errorMessage(err));
      return false;
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, []);

  const initialize = useCallback(async () => {
    // 初次进入默认加载第一页且不带搜索词
    const ok = await loadBooks({ search: '', page: 1 });
    if (ok) {
      setPage(1);
      setSearchTerm('');
    }
  }, [loadBooks]);

  const searchBooks = useCallback(
    async (term: string) => {
      // 去除首尾空格，避免无意义查询
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
    // 按当前筛选条件刷新，不重置用户所在页
    await loadBooks({ search: searchTerm, page });
  }, [loadBooks, page, searchTerm]);

  const goToPage = useCallback(
    async (nextPage: number) => {
      // 防止越界页码与重复请求
      if (loading || totalCount === null) return;
      const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      const clamped = Math.min(Math.max(1, nextPage), maxPage);
      if (clamped === page) return;
      await loadBooks({ search: searchTerm, page: clamped });
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
          // 新封面先上传到 storage，成功后再写 books 表
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
          // 新增图书时可借数量默认等于总库存
          available_quantity: bookData.quantity,
        };

        delete payload.cover_image_file;
        delete payload.remove_cover;

        const { data, error } = await supabase.from('books').insert([payload]).select().single();

        if (error) throw error;

        await refresh();
        return data ?? null;
      } catch (err) {
        // 数据写入失败时回滚已上传文件，避免脏文件残留
        if (uploadedCoverPath) {
          await deleteBookCover(uploadedCoverPath);
        }
        setError(errorMessage(err));
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
          // 更新封面：先上传新图，事务成功后再删旧图
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
        // 更新失败时删除本次新上传文件，保持存储一致性
        if (uploadedCoverPath) {
          await deleteBookCover(uploadedCoverPath);
        }
        setError(errorMessage(err));
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
          // 数据删除后，顺带清理封面文件
          await deleteBookCover(bookToDelete.cover_image_url);
        }

        await refresh();
        return true;
      } catch (err) {
        setError(errorMessage(err));
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
