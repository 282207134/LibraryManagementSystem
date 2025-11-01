import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBorrowings } from '../hooks/useBorrowings';
import type { BorrowingRecord } from '../types/borrowing';

export const UserMyBorrowings = () => {
  const { user } = useAuth();
  const { getUserBorrowings, returnBook, loading } = useBorrowings();
  const [borrowings, setBorrowings] = useState<BorrowingRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'current' | 'history'>('current');

  useEffect(() => {
    if (user) {
      loadBorrowings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadBorrowings = async () => {
    if (!user) return;
    const data = await getUserBorrowings(user.id);
    setBorrowings(data);
  };

  const handleReturn = async (id: string) => {
    if (!window.confirm('确定要归还这本书吗？')) return;

    const result = await returnBook(id);
    if (result.success) {
      alert('归还成功！');
      loadBorrowings();
    } else {
      alert(`归还失败：${result.error}`);
    }
  };

  const filteredBorrowings = borrowings.filter((record) => {
    if (filter === 'current') {
      return record.status === 'borrowed' || record.status === 'overdue';
    }
    if (filter === 'history') {
      return record.status === 'returned';
    }
    return true;
  });

  const currentBorrowingsCount = borrowings.filter(
    (r) => r.status === 'borrowed' || r.status === 'overdue'
  ).length;

  const getDaysRemaining = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading && borrowings.length === 0) {
    return <p className="text-center text-gray-500">加载中...</p>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">我的借阅记录</h1>
        <p className="text-gray-600">
          当前借阅：{currentBorrowingsCount}/5 本
        </p>
      </div>

      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setFilter('current')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'current'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          当前借阅
        </button>
        <button
          onClick={() => setFilter('history')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'history'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          历史记录
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          全部
        </button>
      </div>

      {filteredBorrowings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">
            {filter === 'current' ? '暂无借阅中的图书' : '暂无借阅记录'}
          </p>
          <Link
            to="/user/home"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            去借阅图书 →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBorrowings.map((record) => {
            const daysRemaining = getDaysRemaining(record.due_date);
            const isOverdue = record.status === 'overdue' || daysRemaining < 0;

            return (
              <div
                key={record.id}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    {record.books?.cover_image_url ? (
                      <img
                        src={record.books.cover_image_url}
                        alt={record.books.title}
                        className="w-16 h-24 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-24 bg-gray-200 rounded flex items-center justify-center">
                        📖
                      </div>
                    )}
                    <div>
                      <Link
                        to={`/user/books/${record.book_id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {record.books?.title || '未知图书'}
                      </Link>
                      <p className="text-gray-600 text-sm mt-1">
                        作者：{record.books?.author || '未知'}
                      </p>
                      <p className="text-gray-500 text-sm mt-2">
                        借阅日期：{new Date(record.borrowed_at).toLocaleDateString()}
                      </p>
                      {record.status === 'returned' && record.returned_at ? (
                        <p className="text-gray-500 text-sm">
                          归还日期：{new Date(record.returned_at).toLocaleDateString()}
                        </p>
                      ) : (
                        <>
                          <p className="text-gray-500 text-sm">
                            到期日期：{new Date(record.due_date).toLocaleDateString()}
                          </p>
                          <p
                            className={`text-sm font-medium mt-1 ${
                              isOverdue ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {isOverdue
                              ? `已逾期 ${Math.abs(daysRemaining)} 天`
                              : `剩余 ${daysRemaining} 天`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {(record.status === 'borrowed' || record.status === 'overdue') && (
                    <button
                      onClick={() => handleReturn(record.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                    >
                      归还
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
