import type { Book } from '../types/book';

interface BookCardProps {
  book: Book;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
}

export const BookCard = ({ book, onEdit, onDelete }: BookCardProps) => {
  return (
    <div className="bg-white shadow rounded-lg p-4 space-y-3">
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
  );
};
