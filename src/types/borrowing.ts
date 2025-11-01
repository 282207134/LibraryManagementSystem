import type { Book } from './book';

export type BorrowingStatus = 'borrowed' | 'returned' | 'overdue' | 'lost';

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
}
