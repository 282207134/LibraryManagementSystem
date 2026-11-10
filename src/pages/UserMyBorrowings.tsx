import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBorrowings } from '../hooks/useBorrowings';
import { useLanguage } from '../contexts/LanguageContext';
import { BorrowingTicket } from '../components/BorrowingTicket';
import { BookCover } from '../components/BookCover';
import { isCurrentLoan, isOverdueLoan, loanDays, requestStatus } from '../lib/borrowing';
import { borrowingText } from '../lib/borrowingText';
import type { BorrowingRecord, BorrowingRequest } from '../types/borrowing';

export const UserMyBorrowings = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = borrowingText[language];
  const { getUserBorrowings, getRequests, closeRequest, error, loading } = useBorrowings();
  const [loans, setLoans] = useState<BorrowingRecord[]>([]);
  const [requests, setRequests] = useState<BorrowingRequest[]>([]);
  const [filter, setFilter] = useState<'requests' | 'current' | 'history' | 'all'>('requests');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    if (!user) return;
    const [records, applications] = await Promise.all([getUserBorrowings(user.id), getRequests(user.id)]);
    setLoans(records); setRequests(applications); setNow(Date.now());
  }, [user, getUserBorrowings, getRequests]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);
  const formatDate = (date: string) => new Date(date).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US');
  const pendingCount = requests.filter(request => requestStatus(request, now) === 'pending').length;
  const shownRequests = requests.filter(request => request.status !== 'approved' && (
    filter === 'all' || (filter === 'requests' ? requestStatus(request, now) === 'pending' : filter === 'history' && requestStatus(request, now) !== 'pending')
  ));
  const shownLoans = loans.filter(loan => filter === 'all' || (filter === 'current' ? isCurrentLoan(loan) : filter === 'history' && !isCurrentLoan(loan)));
  const cancel = async (id: string) => {
    if (busy || !confirm(t.cancelConfirm)) return;
    setBusy(true);
    try { const result = await closeRequest(id, 'cancelled'); if (result.success) await load(); }
    finally { setBusy(false); }
  };
  return (
    <div className="borrowing-page">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
        <div><h1 className="text-3xl font-bold">{t.userTitle}</h1><p className="mt-2 text-sm opacity-80">{t.pending}: {pendingCount} · {t.current}: {loans.filter(isCurrentLoan).length}</p></div>
        <button type="button" disabled={loading || busy} onClick={() => void load()} className="loan-secondary">{loading ? t.loading : t.refresh}</button>
      </div>
      <p className="mb-5 text-sm opacity-80">{t.requestPolicy}</p>
      {error && <p role="alert" className="loan-error mb-4">{error}</p>}
      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label={t.userTitle}>
        {(['requests', 'current', 'history', 'all'] as const).map(key => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)} className={filter === key ? 'loan-primary' : 'loan-secondary'}>{t[key]}{key === 'requests' ? ` (${pendingCount})` : ''}</button>)}
      </div>
      <div className="space-y-4" aria-busy={loading}>
        {shownRequests.map(request => {
          const status = requestStatus(request, now);
          return <article key={request.id} className="loan-panel p-4 sm:p-6">
            <div className="flex gap-4">
              <BookCover source={request.books?.cover_image_url} title={request.books?.title || t.unknown} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2"><Link to={`/user/books/${request.book_id}`} className="text-lg font-semibold">{request.books?.title || t.unknown}</Link><span className="loan-badge">{t[status]}</span></div>
                <p className="text-sm mt-1 opacity-80">{request.books?.author}</p>
                <p className="mt-2 text-sm">{t.requested}: {formatDate(request.created_at)}</p>
                {status === 'pending' && <p className="text-sm">{t.expires}: {formatDate(request.expires_at)}</p>}
                {request.review_note && <p className="mt-2 text-sm break-words">{t.note}: {request.review_note}</p>}
              </div>
            </div>
            {status === 'pending' && <><BorrowingTicket code={request.pickup_code} /><button type="button" disabled={busy} onClick={() => void cancel(request.id)} className="loan-secondary mt-4">{t.cancel}</button></>}
          </article>;
        })}
        {shownLoans.map(loan => {
          const overdue = isOverdueLoan(loan, now);
          const ticket = requests.find(request => request.borrowing_id === loan.id);
          return <article key={loan.id} className="loan-panel p-4 sm:p-6">
            <div className="flex gap-4">
              <BookCover source={loan.books?.cover_image_url} title={loan.books?.title || t.unknown} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-2"><Link to={`/user/books/${loan.book_id}`} className="text-lg font-semibold">{loan.books?.title || t.unknown}</Link><span className={overdue ? 'loan-badge loan-overdue' : 'loan-badge'}>{t[overdue ? 'overdue' : loan.status]}</span></div>
                <p className="mt-2 text-sm">{t.borrowedAt}: {formatDate(loan.borrowed_at)}</p>
                {loan.status === 'returned' && loan.returned_at ? <p className="text-sm">{t.returnedAt}: {formatDate(loan.returned_at)}</p> : isCurrentLoan(loan) && <>
                  <p className="text-sm">{t.due}: {formatDate(loan.due_date)}</p>
                  <p className={`text-sm mt-1 ${overdue ? 'text-rose-500' : ''}`}>{overdue ? t.overdueFor : t.remaining} {loanDays(loan, now)} {t.days}</p>
                </>}
              </div>
            </div>
            {isCurrentLoan(loan) && <><p className="mt-4 text-sm opacity-80">{t.returnHint}</p>{ticket && <BorrowingTicket code={ticket.pickup_code} />}</>}
          </article>;
        })}
        {!loading && !error && !shownRequests.length && !shownLoans.length && <div className="text-center py-12"><p>{t.empty}</p><Link to="/user/home" className="inline-block mt-4 underline">{t.browse} →</Link></div>}
      </div>
    </div>
  );
};
