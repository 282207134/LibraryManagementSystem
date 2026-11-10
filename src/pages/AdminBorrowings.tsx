import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Pagination } from '../components/Pagination';
import { CodeScanner } from '../components/CodeScanner';
import { useBorrowings } from '../hooks/useBorrowings';
import { useUserThemePreference } from '../hooks/useUserThemePreference';
import { useLanguage } from '../contexts/LanguageContext';
import { isCurrentLoan, isOverdueLoan, normalizePickupCode, requestStatus } from '../lib/borrowing';
import { borrowingText } from '../lib/borrowingText';
import type { BorrowingRecord, BorrowingRequest } from '../types/borrowing';

export const AdminBorrowings = () => {
  const { isLightTheme } = useUserThemePreference();
  const { language } = useLanguage();
  const t = borrowingText[language];
  const { getAllBorrowings, getRequests, approveRequest, closeRequest, returnBook, loading, error } = useBorrowings();
  const [loans, setLoans] = useState<BorrowingRecord[]>([]);
  const [requests, setRequests] = useState<BorrowingRequest[]>([]);
  const [tab, setTab] = useState<'requests' | 'all'>('requests');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [code, setCode] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [notice, setNotice] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const [records, applications] = await Promise.all([getAllBorrowings(), getRequests()]);
    setLoans(records); setRequests(applications); setNow(Date.now());
    return applications;
  }, [getAllBorrowings, getRequests]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const formatDate = (date: string) => new Date(date).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US');
  const selected = requests.find(request => request.id === selectedId);
  const selectedLoan = selected?.borrowing_id ? loans.find(loan => loan.id === selected.borrowing_id) : undefined;
  const lookup = async (raw: string) => {
    setSelectedId(null); setLookupError(''); setNotice(''); setRejectId(null);
    const normalized = normalizePickupCode(raw);
    if (!normalized) { setLookupError(t.invalidCode); return; }
    setCode(normalized);
    const fresh = await load();
    const found = fresh.find(request => request.pickup_code === normalized);
    if (found) setSelectedId(found.id); else setLookupError(t.notFound);
  };
  const act = async (action: 'approve' | 'reject' | 'return', record: BorrowingRequest | BorrowingRecord) => {
    if (actionLock.current) return;
    if (action === 'reject' && !reason.trim()) { setNotice(t.reasonRequired); return; }
    if (action !== 'reject' && !confirm(action === 'approve' ? t.approveConfirm : t.returnConfirm)) return;
    actionLock.current = true; setBusy(true); setNotice('');
    try {
      const result = action === 'approve' ? await approveRequest((record as BorrowingRequest).pickup_code)
        : action === 'reject' ? await closeRequest(record.id, 'rejected', reason.trim()) : await returnBook(record.id);
      setNotice(result.success ? t.success : result.error || t.failed);
      if (result.success) { setRejectId(null); setReason(''); }
      await load();
    } finally { actionLock.current = false; setBusy(false); }
  };
  const matching = (record: BorrowingRequest | BorrowingRecord) =>
    [record.books?.title, record.books?.author, record.users?.full_name, record.users?.email,
      'pickup_code' in record ? record.pickup_code : ''].some(value => value?.toLowerCase().includes(search.trim().toLowerCase()));
  const items = (tab === 'requests'
    ? requests.filter(request => (filter === 'all' || requestStatus(request, now) === filter) && matching(request))
    : loans.filter(loan => (filter === 'all' || (filter === 'overdue' ? isOverdueLoan(loan, now) : filter === 'borrowed' ? loan.status === 'borrowed' && !isOverdueLoan(loan, now) : loan.status === filter)) && matching(loan)))
    .map(record => ({ record, request: 'pickup_code' in record ? record as BorrowingRequest : null }));
  const totalPages = Math.max(1, Math.ceil(items.length / 8));
  const currentPage = Math.min(page, totalPages);
  const requestButtons = (request: BorrowingRequest) => requestStatus(request, now) === 'pending' && <div className="mt-3 flex flex-wrap gap-2">
    <button type="button" className="loan-primary" disabled={busy || loading} onClick={() => void act('approve', request)}>{t.approve}</button>
    <button type="button" className="loan-secondary" disabled={busy} onClick={() => { setRejectId(request.id); setReason(''); }}>{t.reject}</button>
    {rejectId === request.id && <div className="w-full mt-2">
      <label htmlFor={`reject-${request.id}`} className="block text-sm mb-1">{t.reason}</label>
      <textarea id={`reject-${request.id}`} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={2} className="loan-input w-full" />
      <button type="button" disabled={busy || !reason.trim()} onClick={() => void act('reject', request)} className="loan-secondary mt-2">{t.reject}</button>
    </div>}
  </div>;
  return (
    <div className={`admin-theme borrowing-page min-h-screen ${isLightTheme ? 'bg-[#f7f5f0] text-slate-900' : 'bg-[#060a19] text-cyan-50'}`} data-theme={isLightTheme ? 'light' : 'dark'}>
      <Header />
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        <h1 className="text-3xl font-bold">{t.adminTitle}</h1><p className="mt-2 mb-6 opacity-80">{t.adminSubtitle}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[[t.pending, requests.filter(request => requestStatus(request, now) === 'pending').length], [t.current, loans.filter(isCurrentLoan).length], [t.overdue, loans.filter(loan => isOverdueLoan(loan, now)).length], [t.returned, loans.filter(loan => loan.status === 'returned').length]].map(([label, count]) => <div className="loan-panel p-4" key={label}><p className="text-sm opacity-80">{label}</p><p className="text-2xl font-bold mt-1">{count}</p></div>)}
        </div>
        <section className="loan-panel p-4 mb-6" aria-label={t.lookup}>
          <h2 className="text-lg font-semibold">{t.lookup}</h2><p className="text-sm mt-1 mb-3 opacity-80">{t.lookupHint}</p>
          <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void lookup(code); }}>
            <label className="sr-only" htmlFor="pickup-code-input">{t.inputCode}</label>
            <input id="pickup-code-input" className="loan-input min-w-0 flex-1 font-mono tracking-widest" placeholder={t.inputCode} value={code} inputMode="numeric" autoComplete="off" maxLength={32} onChange={event => { setCode(event.target.value); setSelectedId(null); setLookupError(''); }} />
            <button type="submit" disabled={loading || busy} className="loan-primary">{t.lookup}</button>
            <button type="button" disabled={busy} className="loan-secondary" onClick={() => setScanning(value => !value)}>{t.camera}</button>
          </form>
          {scanning && <CodeScanner onClose={() => setScanning(false)} onCode={value => { setScanning(false); void lookup(value); }} />}
          {lookupError && <p role="alert" className="loan-error mt-3">{lookupError}</p>}
          {selected && <div className="mt-4 border-t border-slate-400/40 pt-4" data-testid="lookup-result">
            <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-lg">{selected.books?.title || t.unknown}</p><span className="loan-badge">{selectedLoan ? t[isOverdueLoan(selectedLoan, now) ? 'overdue' : selectedLoan.status] : t[requestStatus(selected, now)]}</span></div>
            <p className="mt-1 break-words">{t.reader}: {selected.users?.full_name} ({selected.users?.email})</p>
            <p className="font-mono mt-1">{t.code}: {selected.pickup_code}</p>
            {selected.review_note && <p className="mt-2">{t.note}: {selected.review_note}</p>}
            {requestButtons(selected)}
            {selectedLoan && isCurrentLoan(selectedLoan) && <button type="button" disabled={busy || loading} className="loan-primary mt-3" onClick={() => void act('return', selectedLoan)}>{t.return}</button>}
          </div>}
        </section>
        {notice && <p role="status" className="loan-panel p-3 mb-4">{notice}</p>}
        {error && <p role="alert" className="loan-error mb-4">{error}</p>}
        <div className="flex flex-wrap gap-2 mb-3">
          {(['requests', 'all'] as const).map(value => <button type="button" key={value} aria-pressed={tab === value} className={tab === value ? 'loan-primary' : 'loan-secondary'} onClick={() => { setTab(value); setFilter('all'); setPage(1); }}>{value === 'requests' ? t.requests : t.current + ' / ' + t.history}</button>)}
          <button type="button" className="loan-secondary ml-auto" disabled={loading || busy} onClick={() => void load()}>{loading ? t.loading : t.refresh}</button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <input aria-label={t.lookup} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={language === 'zh' ? '搜索图书、姓名、邮箱或数字码' : language === 'ja' ? '図書・氏名・メール・コードで検索' : 'Search books, readers, email or code'} className="loan-input w-full sm:w-80" />
          <select aria-label={t.all} className="loan-input" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}>
            {(tab === 'requests' ? ['all','pending','approved','rejected','cancelled','expired'] as const : ['all','borrowed','overdue','returned','lost'] as const).map(value => <option key={value} value={value}>{t[value]}</option>)}
          </select>
        </div>
        <div className="space-y-3" aria-busy={loading}>
          {items.slice((currentPage - 1) * 8, currentPage * 8).map(({ record, request }) => <article key={record.id} className="loan-panel p-4">
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div className="min-w-0"><Link to={`/user/books/${record.book_id}`} className="font-semibold text-lg">{record.books?.title || t.unknown}</Link><p className="text-sm mt-1 break-words">{t.reader}: {record.users?.full_name || t.unknown} · {record.users?.email || t.unknown}</p></div>
              <span className="loan-badge">{request ? t[requestStatus(request, now)] : t[isOverdueLoan(record as BorrowingRecord, now) ? 'overdue' : (record as BorrowingRecord).status]}</span>
            </div>
            {request ? <><p className="text-sm mt-2">{t.requested}: {formatDate(request.created_at)} · {t.code}: <span className="font-mono select-all">{request.pickup_code}</span></p>{requestStatus(request, now) === 'pending' && <p className="text-sm">{t.expires}: {formatDate(request.expires_at)}</p>}{request.review_note && <p className="text-sm mt-2">{t.note}: {request.review_note}</p>}{selectedId !== request.id && requestButtons(request)}</> : <>
              <p className="text-sm mt-2">{t.borrowedAt}: {formatDate((record as BorrowingRecord).borrowed_at)}</p>
              {isCurrentLoan(record as BorrowingRecord) && <><p className="text-sm">{t.due}: {formatDate((record as BorrowingRecord).due_date)}</p><button type="button" disabled={busy || loading} className="loan-primary mt-3" onClick={() => void act('return', record as BorrowingRecord)}>{t.return}</button></>}
              {(record as BorrowingRecord).returned_at && <p className="text-sm">{t.returnedAt}: {formatDate((record as BorrowingRecord).returned_at!)}</p>}
            </>}
          </article>)}
          {!items.length && !loading && !error && <p className="py-12 text-center">{t.empty}</p>}
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} loading={loading} />
      </main>
    </div>
  );
};
