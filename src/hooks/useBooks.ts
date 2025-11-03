import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { uploadBookCover, deleteBookCover } from '../lib/storageHelper';
import type { Book, BookFormData } from '../types/book';

const PAGE_SIZE = 10;

type LoadOptions = {
  search: string;
  page: number;
  append: boolean;
  currentBooksCount?: number;
};

export const useBooks = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const booksRef = useRef<Book[]>([]); // 使用 ref 存储最新的 books，避免循环依赖
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [hasMore, setHasMore] = useState<boolean>(true);
  
  // 同步 ref 和 state
  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  // 辅助函数：递归加载直到获取足够的非重复数据
  const loadBooksRecursive = useCallback(async (
    search: string,
    startFrom: number,
    totalCount: number,
    existingIds: Set<string>,
    targetCount: number = PAGE_SIZE
  ): Promise<{ newBooks: Book[], finalTo: number }> => {
    const from = startFrom;
    const to = from + targetCount - 1;
    
    console.log('[loadBooksRecursive] 递归加载:', {
      from,
      to,
      existingIdsSize: existingIds.size,
      targetCount,
    });
    
    let query = supabase
      .from('books')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    if (!data || data.length === 0) {
      return { newBooks: [], finalTo: to };
    }
    
    const filtered = data.filter((book) => !existingIds.has(book.id));
    const newIds = new Set([...existingIds, ...filtered.map((book) => book.id)]);
    
    console.log('[loadBooksRecursive] 本次加载:', {
      dataLength: data.length,
      filteredLength: filtered.length,
      totalNew: filtered.length,
    });
    
    // 如果去重后仍然不足目标数量，且还有更多数据，继续递归加载
    if (filtered.length < targetCount && to + 1 < totalCount) {
      const needMore = targetCount - filtered.length;
      const nextResult = await loadBooksRecursive(
        search,
        to + 1,
        totalCount,
        newIds,
        needMore
      );
      return {
        newBooks: [...filtered, ...nextResult.newBooks],
        finalTo: nextResult.finalTo,
      };
    }
    
    return { newBooks: filtered, finalTo: to };
  }, []);

  const loadBooks = useCallback(async ({ search, page, append, currentBooksCount }: LoadOptions) => {
    setLoading(true);
    setError(null);

    const safePage = Math.max(page, 1);
    // 当 append 为 true 时，基于当前已有数量计算，避免重复
    // 当 append 为 false 时，基于页码计算
    const from = append && currentBooksCount !== undefined 
      ? currentBooksCount 
      : (safePage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    console.log('[loadBooks] 开始加载:', {
      page,
      safePage,
      append,
      currentBooksCount,
      search,
      from,
      to,
      PAGE_SIZE,
      range: `${from}-${to}`,
      expectedCount: to - from + 1,
    });

    try {
      // 先查询一次获取总数
      let countQuery = supabase
        .from('books')
        .select('*', { count: 'exact', head: true });
      
      if (search) {
        countQuery = countQuery.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
      }
      
      const { count } = await countQuery;
      
      if (append) {
        // append 模式：使用递归加载确保获取足够的非重复数据
        // 使用 ref 获取最新的 books，避免依赖 books state
        const existingIds = new Set(booksRef.current.map((book) => book.id));
        
        const result = await loadBooksRecursive(
          search,
          from,
          count ?? 0,
          existingIds,
          PAGE_SIZE
        );
        
        console.log('[loadBooks] append 模式 - 递归加载结果:', {
          newBooksCount: result.newBooks.length,
          finalTo: result.finalTo,
        });
        
        setBooks((prev) => {
          // 再次去重，以防在加载过程中状态发生了变化
          const currentIds = new Set(prev.map((book) => book.id));
          const filtered = result.newBooks.filter((book) => !currentIds.has(book.id));
          const newBooks = [...prev, ...filtered];
          console.log('[loadBooks] append 模式 - 合并后总数量:', newBooks.length);
          return newBooks;
        });
        
        // 更新 hasMore
        if (typeof count === 'number') {
          const newHasMore = result.finalTo + 1 < count;
          console.log('[loadBooks] hasMore 计算:', {
            finalTo: result.finalTo + 1,
            count,
            hasMore: newHasMore,
          });
          setHasMore(newHasMore);
        }
      } else {
        // 非 append 模式：直接加载
        let query = supabase
          .from('books')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to);
        
        if (search) {
          query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
        }
        
        const { data, error: queryError, count: queryCount } = await query;
        
        console.log('[loadBooks] 查询结果:', {
          dataLength: data?.length ?? 0,
          count: queryCount,
          error: queryError?.message ?? null,
          firstBookId: data?.[0]?.id ?? null,
          lastBookId: data?.[data?.length - 1]?.id ?? null,
        });
        
        if (queryError) throw queryError;
        
        if (data) {
          console.log('[loadBooks] 替换模式 - 设置图书数量:', data.length);
          setBooks(data);
        } else {
          console.log('[loadBooks] 没有数据，清空列表');
          setBooks([]);
        }
        
        if (typeof queryCount === 'number') {
          const newHasMore = to + 1 < queryCount;
          console.log('[loadBooks] hasMore 计算:', {
            to: to + 1,
            count: queryCount,
            hasMore: newHasMore,
          });
          setHasMore(newHasMore);
        }
      }
    } catch (err) {
      console.error('[loadBooks] 错误:', err);
      setError(err instanceof Error ? err.message : '发生未知错误');
    } finally {
      setLoading(false);
      console.log('[loadBooks] 加载完成');
    }
  }, [loadBooksRecursive]);

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
    console.log('[loadMore] 点击加载更多:', {
      loading,
      hasMore,
      currentPage: page,
      currentBooksCount: books.length,
      searchTerm,
    });

    if (loading || !hasMore) {
      console.log('[loadMore] 跳过加载 - loading:', loading, 'hasMore:', hasMore);
      return;
    }

    const nextPage = page + 1;
    console.log('[loadMore] 准备加载第', nextPage, '页');
    await loadBooks({ 
      search: searchTerm, 
      page: nextPage, 
      append: true,
      currentBooksCount: books.length 
    });
    setPage(nextPage);
    console.log('[loadMore] 页码已更新为:', nextPage);
  }, [loading, hasMore, page, searchTerm, loadBooks, books.length]);

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
        // available_quantity 由数据库触发器自动计算，新增时默认为quantity
        available_quantity: bookData.quantity,
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
      // available_quantity 由数据库触发器自动计算，不在这里设置
      delete payload.available_quantity;

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
    // 只在组件挂载时初始化一次
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖数组，只在挂载时执行一次

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
