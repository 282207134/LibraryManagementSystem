export interface Review {
  id: string;
  book_id: string;
  user_id: string;
  rating: number; // 1-5
  comment?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewWithUser extends Review {
  user_email?: string;
  user_full_name?: string;
}

export interface BookRatingStats {
  average_rating: number;
  total_reviews: number;
  rating_distribution: {
    rating: number;
    count: number;
  }[];
}

