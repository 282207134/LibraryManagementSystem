import type { Book } from './book';

export interface BookFavorite {
  id: string;
  user_id: string;
  book_id: string;
  favorited_at: string;
  books?: Pick<Book, 'id' | 'title' | 'author' | 'cover_image_url' | 'available_quantity'>;
}
