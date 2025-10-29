import { useState, useEffect } from 'react';
import type { Book, BookFormData } from '../types/book';

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
  cover_image_url: '',
};

export const BookForm = ({ book, onSubmit, onCancel }: BookFormProps) => {
  const [formData, setFormData] = useState<BookFormData>({ ...emptyForm });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
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
        cover_image_url: book.cover_image_url ?? '',
      });
      setPreviewError(false);
    } else {
      setFormData({ ...emptyForm });
      setPreviewError(false);
    }
  }, [book]);

  useEffect(() => {
    setPreviewError(false);
  }, [formData.cover_image_url]);

  const handleQuantityChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    const quantity = Number.isNaN(parsed) ? 0 : Math.max(parsed, 0);

    setFormData((prev) => ({
      ...prev,
      quantity,
      available_quantity: Math.min(prev.available_quantity, quantity),
    }));
  };

  const handleAvailableQuantityChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    const available = Number.isNaN(parsed) ? 0 : Math.max(parsed, 0);

    setFormData((prev) => ({
      ...prev,
      available_quantity: Math.min(available, prev.quantity),
    }));
  };

  const handleClearCover = () => {
    setFormData((prev) => ({
      ...prev,
      cover_image_url: '',
    }));
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

    if (formData.available_quantity < 0) {
      alert('可借数量不能为负数');
      return;
    }

    if (formData.available_quantity > formData.quantity) {
      alert('可借数量不能大于库存数量');
      return;
    }

    if (
      formData.publication_year &&
      (formData.publication_year < 1000 || formData.publication_year > 9999)
    ) {
      alert('出版年份必须在 1000 到 9999 之间');
      return;
    }

    const payload: BookFormData = {
      title,
      author,
      quantity: formData.quantity,
      available_quantity: formData.available_quantity,
    };

    if (isbn) payload.isbn = isbn;
    if (publisher) payload.publisher = publisher;
    if (formData.publication_year) payload.publication_year = formData.publication_year;
    if (category) payload.category = category;
    if (description) payload.description = description;
    payload.cover_image_url = coverImageUrl ? coverImageUrl : null;

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewUrl = formData.cover_image_url?.trim() ? formData.cover_image_url.trim() : '';

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
              <label className="block text-sm font-medium text-gray-700 mb-1">封面图片 URL</label>
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="url"
                    value={formData.cover_image_url ?? ''}
                    onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/cover.jpg"
                  />
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={handleClearCover}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      清除封面
                    </button>
                  )}
                </div>
                {previewUrl && !previewError && (
                  <div className="w-32 h-48 overflow-hidden rounded-lg border border-gray-200">
                    <img
                      src={previewUrl}
                      alt={`封面预览 - ${formData.title || '图书'}`}
                      className="w-full h-full object-cover"
                      onError={() => setPreviewError(true)}
                    />
                  </div>
                )}
                {previewError && (
                  <div className="text-sm text-red-600">
                    图片加载失败，请检查链接或尝试其他地址。
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  支持 http(s) 链接，建议使用公开可访问的高清图像。
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
                  可借数量 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.available_quantity}
                  onChange={(e) => handleAvailableQuantityChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max={formData.quantity}
                  required
                />
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
