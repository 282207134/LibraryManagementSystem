import { createContext } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { User, UserRole } from '../types/user';

export interface AuthContextType {
  user: SupabaseUser | null;
  userProfile: User | null;
  userRole: UserRole | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  refreshUserProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
