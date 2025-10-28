import type { Book } from '../types/book';
import { BookCard } from './BookCard';

interface BookListProps {
  books: Book[];
  loading: boolean;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}

export const BookList = ({ books, loading, onEdit, onDelete, onLoadMore, hasMore }: BookListProps) => {
  if (loading && books.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!loading && books.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">暂无图书，请添加新图书。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="hidden md:block overflow-hidden border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                书名
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                作者
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ISBN
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                分类
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                库存数量
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                可借数量
              </th>
              <th scope="col" className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {books.map((book) => (
              <tr key={book.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <div className="flex flex-col">
                    <span>{book.title}</span>
                    {book.publisher && (
                      <span className="text-xs text-gray-500">{book.publisher}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.author}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.isbn || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.category || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.quantity}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.available_quantity}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2 justify-end">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden grid gap-4">
        {books.map((book) => (
          <BookCard key={book.id} book={book} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-4">
        {loading && <span className="text-gray-500">加载中...</span>}

        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '加载中...' : '加载更多'}
          </button>
        )}
      </div>
    </div>
  );
};
