import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { useBorrowings } from '../hooks/useBorrowings';
import { resolveCoverImageUrl } from '../lib/storageHelper';
import type { BorrowingRecord } from '../types/borrowing';

// 封面图片组件
const BorrowingBookCover = ({ coverUrl, title }: { coverUrl?: string | null; title: string }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (coverUrl) {
      resolveCoverImageUrl(coverUrl).then(setImageUrl);
    } else {
      setImageUrl(null);
    }
  }, [coverUrl]);

  return (
    <>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="w-16 h-24 object-cover rounded"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const placeholder = target.nextElementSibling as HTMLElement;
            if (placeholder) placeholder.style.display = 'flex';
          }}
        />
      ) : null}
      <div className={`w-16 h-24 bg-gray-200 rounded flex items-center justify-center ${imageUrl ? 'hidden' : ''}`}>
        📖
      </div>
    </>
  );
};

export const AdminBorrowings = () => {
  const { getAllBorrowings, returnBook, loading } = useBorrowings();
  const [borrowings, setBorrowings] = useState<BorrowingRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'borrowed' | 'returned' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadBorrowings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBorrowings = async () => {
    const data = await getAllBorrowings();
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

  const getDaysRemaining = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  // 筛选和搜索
  const filteredBorrowings = borrowings.filter((record) => {
    // 状态筛选
    if (filter === 'borrowed' && record.status !== 'borrowed') return false;
    if (filter === 'returned' && record.status !== 'returned') return false;
    if (filter === 'overdue' && record.status !== 'overdue') return false;

    // 搜索筛选
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const bookTitle = record.books?.title?.toLowerCase() || '';
      const bookAuthor = record.books?.author?.toLowerCase() || '';
      const userName = record.users?.full_name?.toLowerCase() || '';
      const userEmail = record.users?.email?.toLowerCase() || '';
      
      return (
        bookTitle.includes(searchLower) ||
        bookAuthor.includes(searchLower) ||
        userName.includes(searchLower) ||
        userEmail.includes(searchLower)
      );
    }

    return true;
  });

  // 统计信息
  const stats = {
    total: borrowings.length,
    borrowed: borrowings.filter((r) => r.status === 'borrowed').length,
    returned: borrowings.filter((r) => r.status === 'returned').length,
    overdue: borrowings.filter((r) => r.status === 'overdue').length,
  };

  if (loading && borrowings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">借阅记录管理</h1>
          <p className="text-gray-600">查看和管理所有用户的借阅记录</p>
        </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 mb-1">总记录数</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 mb-1">借阅中</p>
          <p className="text-2xl font-bold text-blue-600">{stats.borrowed}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 mb-1">已归还</p>
          <p className="text-2xl font-bold text-green-600">{stats.returned}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 mb-1">已逾期</p>
          <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="搜索图书标题、作者、用户姓名或邮箱..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={loadBorrowings}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
          >
            刷新
          </button>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setFilter('borrowed')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'borrowed'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            借阅中
          </button>
          <button
            onClick={() => setFilter('overdue')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'overdue'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            已逾期
          </button>
          <button
            onClick={() => setFilter('returned')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'returned'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            已归还
          </button>
        </div>
      </div>

      {/* 借阅记录列表 */}
      {filteredBorrowings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">
            {searchTerm ? '没有找到匹配的借阅记录' : '暂无借阅记录'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              清除搜索条件
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBorrowings.map((record) => {
            const daysRemaining = getDaysRemaining(record.due_date);
            const isOverdue = record.status === 'overdue' || (record.status === 'borrowed' && daysRemaining < 0);

            return (
              <div
                key={record.id}
                className={`bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow ${
                  isOverdue ? 'border-l-4 border-red-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <BorrowingBookCover 
                      coverUrl={record.books?.cover_image_url} 
                      title={record.books?.title || '未知图书'} 
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
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
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            record.status === 'borrowed'
                              ? 'bg-blue-100 text-blue-800'
                              : record.status === 'returned'
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {record.status === 'borrowed' ? '借阅中' :
                           record.status === 'returned' ? '已归还' :
                           record.status === 'overdue' ? '已逾期' : '其他'}
                        </span>
                      </div>

                      {/* 用户信息 */}
                      <div className="bg-gray-50 p-3 rounded-lg mt-2 mb-3">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">借阅用户：</span>
                          {record.users?.full_name || '未知用户'} 
                          <span className="text-gray-500 ml-2">({record.users?.email || '未知邮箱'})</span>
                        </p>
                      </div>

                      {/* 时间信息 */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">借阅日期</p>
                          <p className="text-gray-900 font-medium">
                            {new Date(record.borrowed_at).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        {record.status === 'returned' && record.returned_at ? (
                          <div>
                            <p className="text-gray-500">归还日期</p>
                            <p className="text-gray-900 font-medium">
                              {new Date(record.returned_at).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-gray-500">到期日期</p>
                            <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                              {new Date(record.due_date).toLocaleString('zh-CN')}
                            </p>
                            {!isOverdue && (
                              <p className="text-green-600 text-xs mt-1">
                                剩余 {daysRemaining} 天
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {isOverdue && record.status === 'borrowed' && (
                        <p className="text-red-600 text-sm font-medium mt-2">
                          ⚠️ 已逾期 {Math.abs(daysRemaining)} 天
                        </p>
                      )}

                      {record.notes && (
                        <p className="text-gray-500 text-sm mt-2">
                          备注：{record.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="ml-4 flex flex-col gap-2">
                    {(record.status === 'borrowed' || record.status === 'overdue') && (
                      <button
                        onClick={() => handleReturn(record.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium whitespace-nowrap"
                      >
                        归还
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};

