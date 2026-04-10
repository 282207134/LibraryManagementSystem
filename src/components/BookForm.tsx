import { useState, useEffect } from 'react';
import { useUserThemePreference } from '../hooks/useUserThemePreference';
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
  const { isLightTheme } = useUserThemePreference();

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
  const useEditCoverCompactLayout = Boolean(book && previewUrl && !previewError);

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

  const inputFieldClass = isLightTheme
    ? 'w-full px-3.5 py-2 border border-amber-200 bg-white text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400'
    : 'w-full px-3.5 py-2 border border-cyan-300/25 bg-white/10 text-cyan-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400';

  const labelFieldClass = isLightTheme
    ? 'block text-sm font-medium text-slate-700 mb-1'
    : 'block text-sm font-medium text-cyan-100 mb-1';

  const readOnlyFieldClass = isLightTheme
    ? 'w-full px-3.5 py-2 border border-amber-200 rounded-xl bg-stone-50 text-slate-800'
    : 'w-full px-3.5 py-2 border border-cyan-300/20 rounded-xl bg-white/5 text-cyan-100';

  const ghostButtonClass = isLightTheme
    ? 'px-4 py-2 border border-amber-200 text-slate-700 rounded-xl hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed'
    : 'px-4 py-2 border border-cyan-300/25 text-cyan-100 rounded-xl hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed';

  const ghostButtonClassWide = isLightTheme
    ? 'px-5 py-2 border border-amber-200 text-slate-700 rounded-xl hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed'
    : 'px-5 py-2 border border-cyan-300/25 text-cyan-100 rounded-xl hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed';

  const clearCoverBtnCompact = isLightTheme
    ? 'mt-auto w-28 px-3 py-2 border border-amber-200 text-slate-700 rounded-xl hover:bg-amber-50'
    : 'mt-auto w-28 px-3 py-2 border border-cyan-300/25 text-cyan-100 rounded-xl hover:bg-white/10';

  const clearCoverBtnLoose = isLightTheme
    ? 'mt-2 w-28 px-3 py-2 border border-amber-200 text-slate-700 rounded-xl hover:bg-amber-50'
    : 'mt-2 w-28 px-3 py-2 border border-cyan-300/25 text-cyan-100 rounded-xl hover:bg-white/10';

  const panelShellClass = isLightTheme
    ? 'bg-[#fffdf7] border-amber-200 text-slate-900'
    : 'bg-[#0d142c] border-white/10 text-cyan-50';

  const subtleHint = isLightTheme ? 'text-slate-500' : 'text-cyan-100/55';
  const subtleMuted = isLightTheme ? 'text-slate-500' : 'text-cyan-100/60';
  const previewBorder = isLightTheme ? 'border-amber-200' : 'border-cyan-300/20';
  const linkPickClass = isLightTheme ? 'text-amber-700 hover:text-amber-800' : 'text-cyan-300 hover:text-cyan-200';

  const previewLabelClass = isLightTheme ? 'text-sm text-slate-700 mb-2' : 'text-sm text-cyan-100 mb-2';
  const dragActiveClass = isLightTheme ? 'border-amber-500 bg-amber-100/70' : 'border-cyan-400 bg-cyan-500/10';
  const dragIdleClass = isLightTheme ? 'border-amber-300 hover:border-amber-400 bg-amber-50/40' : 'border-cyan-300/30 hover:border-cyan-300/60 bg-white/5';
  const dragHintClass = isLightTheme ? 'text-amber-800 font-medium' : 'text-cyan-300 font-medium';
  const svgMuted = isLightTheme ? 'text-slate-400' : 'text-cyan-100/50';
  const dropTextClass = isLightTheme ? 'text-sm text-slate-600' : 'text-sm text-cyan-100/75';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div
        className={`border rounded-2xl shadow-xl max-w-[38rem] w-full max-h-[90vh] overflow-y-auto ${panelShellClass}`}
      >
        <div className="p-4">
          <h2 className="text-xl font-bold mb-5">{book ? '编辑图书' : '添加图书'}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelFieldClass}>
                书名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                title="书名"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={inputFieldClass}
                required
              />
            </div>

            <div>
              <label className={labelFieldClass}>
                作者 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                title="作者"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className={inputFieldClass}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelFieldClass}>ISBN</label>
                <input
                  type="text"
                  value={formData.isbn}
                  onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                  className={inputFieldClass}
                  placeholder="10 或 13 位数字"
                />
              </div>

              <div>
                <label className={labelFieldClass}>出版社</label>
                <input
                  type="text"
                  title="出版社"
                  value={formData.publisher}
                  onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                  className={inputFieldClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelFieldClass}>出版年份</label>
                <input
                  type="number"
                  title="出版年份"
                  value={formData.publication_year ?? ''}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    setFormData({
                      ...formData,
                      publication_year: Number.isNaN(parsed) ? undefined : parsed,
                    });
                  }}
                  className={inputFieldClass}
                  min="1000"
                  max="9999"
                />
              </div>

              <div>
                <label className={labelFieldClass}>分类</label>
                <input
                  type="text"
                  title="分类"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className={inputFieldClass}
                />
              </div>
            </div>

            <div>
              <label className={labelFieldClass}>简介</label>
              <textarea
                title="简介"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={inputFieldClass}
                rows={2}
              />
            </div>

            <div>
              <label className={labelFieldClass}>
                封面图片
                <span className={`${subtleMuted} text-xs font-normal ml-2`}>
                  (支持点击选择或拖拽上传)
                </span>
              </label>

              <div className="space-y-2">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-3 transition-colors ${
                    isDragging ? dragActiveClass : dragIdleClass
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    {isDragging ? (
                      <p className={dragHintClass}>松开鼠标以上传图片</p>
                    ) : (
                      <>
                        <svg
                          className={`w-10 h-10 ${svgMuted}`}
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
                        <p className={dropTextClass}>
                          拖拽图片到这里，或{' '}
                          <label className={`${linkPickClass} cursor-pointer underline`}>
                            点击选择文件
                          </label>
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    title="封面图片文件"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                    id="cover-image-input"
                  />
                </div>

                {previewError && (
                  <div className="text-sm text-red-600">
                    图片加载失败，请重新选择图片。
                  </div>
                )}
                <p className={`text-xs ${subtleHint}`}>
                  支持 JPEG、PNG、GIF 和 WebP 格式，文件大小不超过 5MB。
                </p>

                {useEditCoverCompactLayout ? (
                  <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 items-stretch min-h-[14.5rem]">
                    <div className="h-full flex flex-col">
                      <p className={previewLabelClass}>预览：</p>
                      <div className={`w-28 h-40 overflow-hidden rounded-lg border ${previewBorder}`}>
                        <img
                          src={previewUrl}
                          alt={`封面预览 - ${formData.title || '图书'}`}
                          className="w-full h-full object-cover"
                          onError={() => setPreviewError(true)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleClearCover}
                        className={clearCoverBtnCompact}
                      >
                        清除封面
                      </button>
                    </div>

                    <div className="h-full min-h-[12rem] flex flex-col">
                      <div className="space-y-3">
                        <div>
                          <label className={labelFieldClass}>
                            库存数量 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            title="库存数量"
                            value={formData.quantity}
                            onChange={(e) => handleQuantityChange(e.target.value)}
                            className={inputFieldClass}
                            min="0"
                            required
                          />
                        </div>

                        <div>
                          <label className={labelFieldClass}>
                            可借数量 <span className={`${subtleHint} text-xs`}>(自动计算)</span>
                          </label>
                          <div className={readOnlyFieldClass}>
                            {calculatedAvailableQuantity} / {formData.quantity}
                            {borrowedCount > 0 && (
                              <span className={`text-xs ${subtleHint} ml-2`}>
                                (已借出: {borrowedCount})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2.5 mt-auto pt-10">
                        <button
                          type="button"
                          onClick={onCancel}
                          disabled={isSubmitting}
                          className={ghostButtonClass}
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-4 py-2 text-white rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? '保存中...' : book ? '更新' : '添加'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {previewUrl && !previewError && (
                      <div className="mt-2">
                        <p className={previewLabelClass}>预览：</p>
                        <div className={`w-28 h-40 overflow-hidden rounded-lg border ${previewBorder}`}>
                          <img
                            src={previewUrl}
                            alt={`封面预览 - ${formData.title || '图书'}`}
                            className="w-full h-full object-cover"
                            onError={() => setPreviewError(true)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleClearCover}
                          className={clearCoverBtnLoose}
                        >
                          清除封面
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {!useEditCoverCompactLayout && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelFieldClass}>
                    库存数量 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    title="库存数量"
                    value={formData.quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className={inputFieldClass}
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className={labelFieldClass}>
                    可借数量 <span className={`${subtleHint} text-xs`}>(自动计算)</span>
                  </label>
                  <div className={readOnlyFieldClass}>
                    {calculatedAvailableQuantity} / {formData.quantity}
                    {borrowedCount > 0 && (
                      <span className={`text-xs ${subtleHint} ml-2`}>
                        (已借出: {borrowedCount})
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${subtleHint} mt-1`}>
                    可借数量 = 库存数量 - 已借出数量（由系统自动计算）
                  </p>
                </div>
              </div>
            )}

            {!useEditCoverCompactLayout && (
              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className={ghostButtonClassWide}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-white rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '保存中...' : book ? '更新' : '添加'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
