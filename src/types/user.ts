export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  address?: string | null;
  member_since: string;
  max_borrow_limit: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  full_name: string;
  phone?: string | null;
  address?: string | null;
}
