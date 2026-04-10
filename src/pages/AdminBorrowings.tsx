import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { useBorrowings } from '../hooks/useBorrowings';
import { useUserThemePreference } from '../hooks/useUserThemePreference';
import { resolveCoverImageUrl } from '../lib/storageHelper';
import type { BorrowingRecord } from '../types/borrowing';

// 封面图片组件
const BorrowingBookCover = ({
  coverUrl,
  title,
  isLightTheme,
}: {
  coverUrl?: string | null;
  title: string;
  isLightTheme: boolean;
}) => {
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
      <div
        className={`w-16 h-24 rounded flex items-center justify-center ${
          isLightTheme
            ? 'bg-stone-100 border border-amber-200/80 text-slate-500'
            : 'bg-slate-800 border border-white/10 text-cyan-100/70'
        } ${imageUrl ? 'hidden' : ''}`}
      >
        📖
      </div>
    </>
  );
};

export const AdminBorrowings = () => {
  const { isLightTheme } = useUserThemePreference();
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

  const filterBtnClass = (key: 'all' | 'borrowed' | 'overdue' | 'returned') =>
    `px-4 py-2.5 rounded-xl font-medium transition-colors ${
      filter === key
        ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
        : isLightTheme
          ? 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-50'
          : 'bg-white/10 text-cyan-100 border border-cyan-300/20 hover:bg-white/20'
    }`;

  const statCardClass = isLightTheme
    ? 'bg-white p-4 rounded-xl border border-amber-200/90 shadow-sm'
    : 'bg-[#0d142d]/80 p-4 rounded-xl border border-white/10';

  const muted = isLightTheme ? 'text-slate-500' : 'text-cyan-100/70';
  const heading = isLightTheme ? 'text-slate-900' : 'text-cyan-50';
  const statNum = isLightTheme ? 'text-slate-900' : 'text-cyan-50';

  if (loading && borrowings.length === 0) {
    return (
      <div
        className={`admin-theme min-h-screen transition-colors ${isLightTheme ? 'bg-[#f7f3e8] text-gray-900' : 'bg-[#060a19] text-cyan-50'}`}
        data-theme={isLightTheme ? 'light' : 'dark'}
      >
        <Header />
        <div className="text-center py-12">
          <p className={muted}>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`admin-theme min-h-screen transition-colors ${isLightTheme ? 'bg-[#f7f3e8] text-gray-900' : 'bg-[#060a19] text-cyan-50'}`}
      data-theme={isLightTheme ? 'light' : 'dark'}
    >
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${heading}`}>借阅记录管理</h1>
          <p className={muted}>查看和管理所有用户的借阅记录</p>
        </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={statCardClass}>
          <p className={`text-sm ${muted} mb-1`}>总记录数</p>
          <p className={`text-2xl font-bold ${statNum}`}>{stats.total}</p>
        </div>
        <div className={statCardClass}>
          <p className={`text-sm ${muted} mb-1`}>借阅中</p>
          <p className={`text-2xl font-bold ${isLightTheme ? 'text-cyan-700' : 'text-cyan-300'}`}>{stats.borrowed}</p>
        </div>
        <div className={statCardClass}>
          <p className={`text-sm ${muted} mb-1`}>已归还</p>
          <p className={`text-2xl font-bold ${isLightTheme ? 'text-emerald-700' : 'text-emerald-300'}`}>{stats.returned}</p>
        </div>
        <div className={statCardClass}>
          <p className={`text-sm ${muted} mb-1`}>已逾期</p>
          <p className={`text-2xl font-bold ${isLightTheme ? 'text-rose-600' : 'text-rose-300'}`}>{stats.overdue}</p>
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
            className={
              isLightTheme
                ? 'flex-1 px-4 py-2.5 border border-amber-200 bg-white text-slate-900 placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent'
                : 'flex-1 px-4 py-2.5 border border-cyan-300/25 bg-white/10 text-cyan-50 placeholder:text-cyan-100/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent'
            }
          />
          <button
            type="button"
            onClick={loadBorrowings}
            className={
              isLightTheme
                ? 'px-4 py-2.5 bg-white text-slate-700 border border-amber-200 rounded-xl hover:bg-amber-50 font-medium transition-colors'
                : 'px-4 py-2.5 bg-white/10 text-cyan-100 border border-cyan-300/20 rounded-xl hover:bg-white/20 font-medium transition-colors'
            }
          >
            刷新
          </button>
        </div>

        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => setFilter('all')} className={filterBtnClass('all')}>
            全部
          </button>
          <button type="button" onClick={() => setFilter('borrowed')} className={filterBtnClass('borrowed')}>
            借阅中
          </button>
          <button type="button" onClick={() => setFilter('overdue')} className={filterBtnClass('overdue')}>
            已逾期
          </button>
          <button type="button" onClick={() => setFilter('returned')} className={filterBtnClass('returned')}>
            已归还
          </button>
        </div>
      </div>

      {/* 借阅记录列表 */}
      {filteredBorrowings.length === 0 ? (
        <div
          className={
            isLightTheme
              ? 'text-center py-12 bg-white rounded-xl border border-amber-200/90 shadow-sm'
              : 'text-center py-12 bg-[#0d142d]/80 rounded-xl border border-white/10'
          }
        >
          <p className={`${muted} mb-4`}>
            {searchTerm ? '没有找到匹配的借阅记录' : '暂无借阅记录'}
          </p>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className={
                isLightTheme
                  ? 'text-amber-700 hover:text-amber-900 font-medium'
                  : 'text-cyan-300 hover:text-cyan-200 font-medium'
              }
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
                className={`p-6 rounded-xl transition-colors ${
                  isLightTheme
                    ? 'bg-white border border-amber-200/90 shadow-sm hover:border-amber-300'
                    : 'bg-[#0d142d]/80 border border-white/10 hover:border-cyan-300/30'
                } ${isOverdue ? 'border-l-4 border-red-500' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <BorrowingBookCover
                      coverUrl={record.books?.cover_image_url}
                      title={record.books?.title || '未知图书'}
                      isLightTheme={isLightTheme}
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <Link
                            to={`/user/books/${record.book_id}`}
                            className={
                              isLightTheme
                                ? 'text-lg font-semibold text-slate-900 hover:text-amber-800'
                                : 'text-lg font-semibold text-cyan-50 hover:text-cyan-300'
                            }
                          >
                            {record.books?.title || '未知图书'}
                          </Link>
                          <p className={`text-sm mt-1 ${muted}`}>
                            作者：{record.books?.author || '未知'}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            record.status === 'borrowed'
                              ? 'bg-cyan-500/20 text-cyan-200'
                              : record.status === 'returned'
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : record.status === 'overdue'
                              ? 'bg-rose-500/20 text-rose-200'
                              : 'bg-white/10 text-cyan-100'
                          }`}
                        >
                          {record.status === 'borrowed' ? '借阅中' :
                           record.status === 'returned' ? '已归还' :
                           record.status === 'overdue' ? '已逾期' : '其他'}
                        </span>
                      </div>

                      {/* 用户信息 */}
                      <div
                        className={
                          isLightTheme
                            ? 'bg-amber-50/80 p-3 rounded-lg mt-2 mb-3 border border-amber-200/80'
                            : 'bg-white/5 p-3 rounded-lg mt-2 mb-3 border border-white/10'
                        }
                      >
                        <p className={`text-sm ${isLightTheme ? 'text-slate-800' : 'text-cyan-100/90'}`}>
                          <span className="font-medium">借阅用户：</span>
                          {record.users?.full_name || '未知用户'}
                          <span className={`${isLightTheme ? 'text-slate-500' : 'text-cyan-100/60'} ml-2`}>
                            ({record.users?.email || '未知邮箱'})
                          </span>
                        </p>
                      </div>

                      {/* 时间信息 */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className={muted}>借阅日期</p>
                          <p className={`font-medium ${heading}`}>
                            {new Date(record.borrowed_at).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        {record.status === 'returned' && record.returned_at ? (
                          <div>
                            <p className={muted}>归还日期</p>
                            <p className={`font-medium ${heading}`}>
                              {new Date(record.returned_at).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className={muted}>到期日期</p>
                            <p
                              className={`font-medium ${isOverdue ? 'text-rose-600' : isLightTheme ? 'text-slate-900' : 'text-cyan-50'}`}
                            >
                              {new Date(record.due_date).toLocaleString('zh-CN')}
                            </p>
                            {!isOverdue && (
                              <p
                                className={
                                  isLightTheme ? 'text-emerald-700 text-xs mt-1' : 'text-emerald-300 text-xs mt-1'
                                }
                              >
                                剩余 {daysRemaining} 天
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {isOverdue && record.status === 'borrowed' && (
                        <p
                          className={
                            isLightTheme ? 'text-rose-600 text-sm font-medium mt-2' : 'text-rose-300 text-sm font-medium mt-2'
                          }
                        >
                          ⚠️ 已逾期 {Math.abs(daysRemaining)} 天
                        </p>
                      )}

                      {record.notes && (
                        <p className={`text-sm mt-2 ${isLightTheme ? 'text-slate-600' : 'text-cyan-100/65'}`}>
                          备注：{record.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="ml-4 flex flex-col gap-2">
                    {(record.status === 'borrowed' || record.status === 'overdue') && (
                      <button
                        type="button"
                        onClick={() => handleReturn(record.id)}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl hover:from-emerald-400 hover:to-cyan-500 text-sm font-medium whitespace-nowrap transition-all shadow-[0_10px_24px_-12px_rgba(16,185,129,0.8)]"
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

