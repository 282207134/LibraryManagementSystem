import type { BorrowingRecord, BorrowingRequest, RequestStatus } from '../types/borrowing';

export const normalizePickupCode = (value: string): string | null => {
  const code = value.trim().replace(/\s/g, '');
  return /^\d{8}$/.test(code) ? code : null;
};

export const requestStatus = (request: BorrowingRequest, now = Date.now()): RequestStatus =>
  request.status === 'pending' && new Date(request.expires_at).getTime() <= now ? 'expired' : request.status;

export const isCurrentLoan = (record: BorrowingRecord): boolean =>
  record.status === 'borrowed' || record.status === 'overdue';

export const isOverdueLoan = (record: BorrowingRecord, now = Date.now()): boolean =>
  isCurrentLoan(record) && (record.status === 'overdue' || new Date(record.due_date).getTime() < now);

export const loanDays = (record: BorrowingRecord, now = Date.now()): number =>
  Math.ceil(Math.abs(new Date(record.due_date).getTime() - now) / 86400000);

export const errorMessage = (error: unknown): string =>
  error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message : '请求失败，请稍后重试';
