import type { Book } from './book';

export type BorrowingStatus = 'borrowed' | 'returned' | 'overdue' | 'lost';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export interface BorrowingRequest {
  id: string;
  book_id: string;
  user_id: string;
  pickup_code: string;
  status: RequestStatus;
  requested_days: number;
  created_at: string;
  expires_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  borrowing_id: string | null;
  books?: Pick<Book, 'id' | 'title' | 'author' | 'cover_image_url'>;
  users?: { id: string; email: string; full_name: string } | null;
}

export interface BorrowingRecord {
  id: string;
  book_id: string;
  user_id: string;
  borrowed_at: string;
  due_date: string;
  returned_at?: string | null;
  status: BorrowingStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  books?: Pick<Book, 'id' | 'title' | 'author' | 'cover_image_url'>;
  users?: {
    id: string;
    email: string;
    full_name: string;
  };
}
