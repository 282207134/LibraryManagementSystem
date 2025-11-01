import type { Book } from '../types/book';
import { useState, useEffect } from 'react';
import { resolveCoverImageUrl } from '../lib/storageHelper';

interface BookCardProps {
  book: Book;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
}

export const BookCard = ({ book, onEdit, onDelete }: BookCardProps) => {
  const [imageError, setImageError] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const loadImage = async () => {
      if (book.cover_image_url) {
        const url = await resolveCoverImageUrl(book.cover_image_url);
        if (mounted) {
          setResolvedImageUrl(url);
        }
      } else {
        setResolvedImageUrl(null);
      }
    };

    loadImage();

    return () => {
      mounted = false;
    };
  }, [book.cover_image_url]);

  useEffect(() => {
    setImageError(false);
  }, [resolvedImageUrl]);

  const hasValidImage = resolvedImageUrl && !imageError;

  return (
    <div className="bg-white shadow rounded-lg p-4 flex gap-4">
      {hasValidImage && (
        <div className="flex-shrink-0">
          <img
            src={resolvedImageUrl}
            alt={`${book.title} 封面`}
            className="w-20 h-28 object-cover rounded"
            onError={() => setImageError(true)}
          />
        </div>
      )}
      <div className="flex-1 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{book.title}</h3>
          <p className="text-sm text-gray-600">{book.author}</p>
        </div>
        <div className="space-y-1 text-sm text-gray-700">
          {book.isbn && (
            <p>
              <span className="font-medium">ISBN: </span>
              {book.isbn}
            </p>
          )}
          {book.category && (
            <p>
              <span className="font-medium">分类: </span>
              {book.category}
            </p>
          )}
          <p>
            <span className="font-medium">库存数量: </span>
            {book.quantity}
          </p>
          <p>
            <span className="font-medium">可借数量: </span>
            {book.available_quantity}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(book)}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200"
          >
            编辑
          </button>
          <button
            onClick={() => onDelete(book)}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
};
