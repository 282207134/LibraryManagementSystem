import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBorrowings } from '../hooks/useBorrowings';
import { resolveCoverImageUrl } from '../lib/storageHelper';
import { useLanguage } from '../contexts/LanguageContext';
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

export const UserMyBorrowings = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const textMap = {
    zh: {
      confirmReturn: '确定要归还这本书吗？',
      returnSuccess: '归还成功！',
      returnFail: '归还失败',
      loading: '加载中...',
      pageTitle: '我的借阅记录',
      currentCount: '当前借阅',
      bookUnit: '本',
      tabCurrent: '当前借阅',
      tabHistory: '历史记录',
      tabAll: '全部',
      noCurrent: '暂无借阅中的图书',
      noRecords: '暂无借阅记录',
      goBorrow: '去借阅图书',
      unknownBook: '未知图书',
      unknown: '未知',
      author: '作者',
      borrowedAt: '借阅日期',
      returnedAt: '归还日期',
      dueAt: '到期日期',
      overdue: '已逾期',
      remaining: '剩余',
      day: '天',
      returnBtn: '归还',
    },
    en: {
      confirmReturn: 'Return this book?',
      returnSuccess: 'Returned successfully!',
      returnFail: 'Return failed',
      loading: 'Loading...',
      pageTitle: 'My Borrowings',
      currentCount: 'Current borrowings',
      bookUnit: '',
      tabCurrent: 'Current',
      tabHistory: 'History',
      tabAll: 'All',
      noCurrent: 'No current borrowings',
      noRecords: 'No borrowing records',
      goBorrow: 'Browse books',
      unknownBook: 'Unknown book',
      unknown: 'Unknown',
      author: 'Author',
      borrowedAt: 'Borrowed At',
      returnedAt: 'Returned At',
      dueAt: 'Due Date',
      overdue: 'Overdue',
      remaining: 'Remaining',
      day: 'days',
      returnBtn: 'Return',
    },
    ja: {
      confirmReturn: 'この本を返却しますか？',
      returnSuccess: '返却しました！',
      returnFail: '返却に失敗しました',
      loading: '読み込み中...',
      pageTitle: '貸出履歴',
      currentCount: '現在の貸出',
      bookUnit: '冊',
      tabCurrent: '現在',
      tabHistory: '履歴',
      tabAll: 'すべて',
      noCurrent: '貸出中の本はありません',
      noRecords: '貸出履歴はありません',
      goBorrow: '本を借りる',
      unknownBook: '不明な図書',
      unknown: '不明',
      author: '著者',
      borrowedAt: '貸出日',
      returnedAt: '返却日',
      dueAt: '返却期限',
      overdue: '期限超過',
      remaining: '残り',
      day: '日',
      returnBtn: '返却',
    },
  } as const;
  const t = textMap[language];
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
    if (!window.confirm(t.confirmReturn)) return;

    const result = await returnBook(id);
    if (result.success) {
      alert(t.returnSuccess);
      loadBorrowings();
    } else {
      alert(`${t.returnFail}: ${result.error}`);
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
    return <p className="text-center text-gray-500">{t.loading}</p>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-write-900 mb-2">{t.pageTitle}</h1>
        <p className="text-gray-600">
          {t.currentCount}: {currentBorrowingsCount} {t.bookUnit}
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
          {t.tabCurrent}
        </button>
        <button
          onClick={() => setFilter('history')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'history'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          {t.tabHistory}
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          {t.tabAll}
        </button>
      </div>

      {filteredBorrowings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">
            {filter === 'current' ? t.noCurrent : t.noRecords}
          </p>
          <Link
            to="/user/home"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {t.goBorrow} →
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
                    <BorrowingBookCover 
                      coverUrl={record.books?.cover_image_url} 
                      title={record.books?.title || t.unknownBook}
                    />
                    <div>
                      <Link
                        to={`/user/books/${record.book_id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {record.books?.title || t.unknownBook}
                      </Link>
                      <p className="text-gray-600 text-sm mt-1">
                        {t.author}: {record.books?.author || t.unknown}
                      </p>
                      <p className="text-gray-500 text-sm mt-2">
                        {t.borrowedAt}: {new Date(record.borrowed_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US')}
                      </p>
                      {record.status === 'returned' && record.returned_at ? (
                        <p className="text-gray-500 text-sm">
                          {t.returnedAt}: {new Date(record.returned_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US')}
                        </p>
                      ) : (
                        <>
                          <p className="text-gray-500 text-sm">
                            {t.dueAt}: {new Date(record.due_date).toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US')}
                          </p>
                          <p
                            className={`text-sm font-medium mt-1 ${
                              isOverdue ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {isOverdue
                              ? `${t.overdue} ${Math.abs(daysRemaining)} ${t.day}`
                              : `${t.remaining} ${daysRemaining} ${t.day}`}
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
                      {t.returnBtn}
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
