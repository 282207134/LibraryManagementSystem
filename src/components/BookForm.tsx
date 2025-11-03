import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Book, BookFormData } from '../types/book';
import { validateImageFile, resolveCoverImageUrl } from '../lib/storageHelper';

interface BookFormProps {
  book?: Book | null;
  onSubmit: (bookData: BookFormData) => Promise<void>;
  onCancel: () => void;
}

const emptyForm: BookFormData = {
  title: '',
  author: '',
  isbn: '',
  publisher: '',
  publication_year: undefined,
  category: '',
  description: '',
  quantity: 1,
  available_quantity: 1,
  cover_image_url: null,
  cover_image_file: null,
  remove_cover: false,
};

export const BookForm = ({ book, onSubmit, onCancel }: BookFormProps) => {
  const [formData, setFormData] = useState<BookFormData>({ ...emptyForm });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [borrowedCount, setBorrowedCount] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadBookData = async () => {
      if (book) {
        setFormData({
          title: book.title,
          author: book.author,
          isbn: book.isbn || '',
          publisher: book.publisher || '',
          publication_year: book.publication_year ?? undefined,
          category: book.category || '',
          description: book.description || '',
          quantity: book.quantity,
          available_quantity: book.available_quantity,
          cover_image_url: book.cover_image_url ?? null,
          cover_image_file: null,
          remove_cover: false,
        });

        // 查询当前借出的数量
        const { count } = await supabase
          .from('borrowing_records')
          .select('*', { count: 'exact', head: true })
          .eq('book_id', book.id)
          .in('status', ['borrowed', 'overdue']);

        if (mounted) {
          setBorrowedCount(count || 0);
        }

        if (book.cover_image_url) {
          const resolvedUrl = await resolveCoverImageUrl(book.cover_image_url);
          if (mounted) {
            const fallbackUrl = resolvedUrl ?? book.cover_image_url ?? '';
            setPreviewUrl(fallbackUrl);
            setPreviewError(false);
          }
        } else if (mounted) {
          setPreviewUrl('');
          setPreviewError(false);
        }
      } else {
        setFormData({ ...emptyForm });
        setPreviewUrl('');
        setPreviewError(false);
        setBorrowedCount(0);
      }
    };

    loadBookData();

    return () => {
      mounted = false;
    };
  }, [book]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // 粘贴上传功能（仅在表单打开时启用）
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // 检查是否在表单区域（避免在其他输入框粘贴时误触发）
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        // 如果焦点在输入框或文本域中，不处理图片粘贴
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // 检查是否是图片类型
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            e.stopPropagation();
            // 转换为File对象
            const imageFile = new File([file], `paste-${Date.now()}.${file.type.split('/')[1] || 'png'}`, {
              type: file.type,
            });
            processFile(imageFile);
            break; // 只处理第一个图片
          }
        }
      }
    };

    // 添加粘贴事件监听器
    document.addEventListener('paste', handlePaste);

    return () => {
      // 清理事件监听器
      document.removeEventListener('paste', handlePaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuantityChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    const quantity = Number.isNaN(parsed) ? 0 : Math.max(parsed, 0);

    setFormData((prev) => ({
      ...prev,
      quantity,
      // available_quantity 将由数据库自动计算，这里不再需要手动设置
    }));
  };

  // 计算可借数量（只读显示）
  const calculatedAvailableQuantity = Math.max(0, formData.quantity - borrowedCount);

  // 处理文件（统一处理从不同来源获取的文件）
  const processFile = (file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setPreviewError(false);

    setFormData((prev) => ({
      ...prev,
      cover_image_file: file,
      remove_cover: false,
      cover_image_url: null,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Reset the input value so the same file can be selected again if needed
    e.target.value = '';
  };

  // 拖拽上传处理
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      processFile(file);
    }
  };

  const handleClearCover = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setFormData((prev) => ({
      ...prev,
      cover_image_url: null,
      cover_image_file: null,
      remove_cover: true,
    }));
    setPreviewUrl('');
    setPreviewError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const title = formData.title.trim();
    const author = formData.author.trim();
    const isbn = formData.isbn?.trim();
    const publisher = formData.publisher?.trim();
    const category = formData.category?.trim();
    const description = formData.description?.trim();
    const coverImageUrl = formData.cover_image_url?.trim();

    if (!title || !author) {
      alert('书名和作者为必填项');
      return;
    }

    if (isbn && !/^[0-9]{10}([0-9]{3})?$/.test(isbn)) {
      alert('ISBN 格式不正确（应为 10 位或 13 位数字）');
      return;
    }

    if (formData.quantity < 0) {
      alert('库存数量不能为负数');
      return;
    }

    if (
      formData.publication_year &&
      (formData.publication_year < 1000 || formData.publication_year > 9999)
    ) {
      alert('出版年份必须在 1000 到 9999 之间');
      return;
    }

    // available_quantity 将由数据库触发器自动计算，不在这里设置
    const payload: BookFormData = {
      title,
      author,
      quantity: formData.quantity,
      isbn: isbn || '',
      publisher: publisher || '',
      publication_year: formData.publication_year,
      category: category || '',
      description: description || '',
      available_quantity: formData.available_quantity,
      cover_image_url: coverImageUrl || null,
      cover_image_file: formData.cover_image_file || null,
      remove_cover: formData.remove_cover || false,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">{book ? '编辑图书' : '添加图书'}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                书名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                作者 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                <input
                  type="text"
                  value={formData.isbn}
                  onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10 或 13 位数字"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">出版社</label>
                <input
                  type="text"
                  value={formData.publisher}
                  onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">出版年份</label>
                <input
                  type="number"
                  value={formData.publication_year ?? ''}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    setFormData({
                      ...formData,
                      publication_year: Number.isNaN(parsed) ? undefined : parsed,
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1000"
                  max="9999"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">简介</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                封面图片
                <span className="text-gray-500 text-xs font-normal ml-2">
                  (支持点击选择、拖拽上传或粘贴图片)
                </span>
              </label>
              <div className="space-y-2">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    {isDragging ? (
                      <p className="text-blue-600 font-medium">松开鼠标以上传图片</p>
                    ) : (
                      <>
                        <svg
                          className="w-12 h-12 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="text-sm text-gray-600">
                          拖拽图片到这里，或{' '}
                          <label className="text-blue-600 hover:text-blue-700 cursor-pointer underline">
                            点击选择文件
                          </label>
                        </p>
                        <p className="text-xs text-gray-500">也可以在网页中复制图片后直接粘贴</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                    id="cover-image-input"
                  />
                  <label
                    htmlFor="cover-image-input"
                    className="cursor-pointer"
                    onClick={(e) => {
                      // 如果点击的是label，不阻止默认行为
                      if (isDragging) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <div className="mt-4 text-center">
                      <span className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                        选择文件
                      </span>
                    </div>
                  </label>
                </div>
                {previewUrl && !previewError && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-700 mb-2">预览：</p>
                    <div className="w-32 h-48 overflow-hidden rounded-lg border border-gray-200">
                      <img
                        src={previewUrl}
                        alt={`封面预览 - ${formData.title || '图书'}`}
                        className="w-full h-full object-cover"
                        onError={() => setPreviewError(true)}
                      />
                    </div>
                  </div>
                )}
                {previewError && (
                  <div className="text-sm text-red-600">
                    图片加载失败，请重新选择图片。
                  </div>
                )}
                {previewUrl && (
                  <button
                    type="button"
                    onClick={handleClearCover}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    清除封面
                  </button>
                )}
                <p className="text-xs text-gray-500">
                  支持 JPEG、PNG、GIF 和 WebP 格式，文件大小不超过 5MB。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  库存数量 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  可借数量 <span className="text-gray-500 text-xs">(自动计算)</span>
                </label>
                <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                  {calculatedAvailableQuantity} / {formData.quantity}
                  {borrowedCount > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      (已借出: {borrowedCount})
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  可借数量 = 库存数量 - 已借出数量（由系统自动计算）
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '保存中...' : book ? '更新' : '添加'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
