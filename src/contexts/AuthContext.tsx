import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { AuthContext, type AuthContextType } from './AuthContextBase';

export { AuthContext } from './AuthContextBase';

const createDefaultProfile = (supabaseUser: SupabaseUser) => ({
  id: supabaseUser.id,
  email: supabaseUser.email ?? '',
  full_name: (supabaseUser.user_metadata?.name as string | undefined) ?? supabaseUser.email ?? '用户',
  role: 'user' as const,
  phone: null,
  address: null,
  member_since: new Date().toISOString(),
  max_borrow_limit: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [userProfile, setUserProfile] = useState<AuthContextType['userProfile']>(null);
  const [userRole, setUserRole] = useState<AuthContextType['userRole']>(null);
  const [session, setSession] = useState<AuthContextType['session']>(null);
  const [loading, setLoading] = useState<AuthContextType['loading']>(true);

  const loadUserProfile = useCallback(
    async (supabaseUser: SupabaseUser | null) => {
      if (!supabaseUser) {
        setUserProfile(null);
        setUserRole(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', supabaseUser.id)
          .maybeSingle();

        if (error) {
          console.error('加载用户信息失败', error);
          setUserProfile(null);
          setUserRole(null);
          return;
        }

        if (data) {
          setUserProfile(data);
          setUserRole(data.role ?? 'user');
          return;
        }

        const defaultProfile = createDefaultProfile(supabaseUser);
        const { data: insertedProfile, error: insertError } = await supabase
          .from('users')
          .insert(defaultProfile)
          .select()
          .single();

        if (insertError) {
          console.error('创建用户信息失败', insertError);
          setUserProfile(null);
          setUserRole(null);
          return;
        }

        setUserProfile(insertedProfile);
        setUserRole(insertedProfile.role ?? 'user');
      } catch (error) {
        console.error('获取用户资料时发生错误', error);
        setUserProfile(null);
        setUserRole(null);
      }
    },
    []
  );

  const refreshUserProfile = useCallback(async () => {
    await loadUserProfile(user);
  }, [loadUserProfile, user]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      const currentSession = data.session;
      const currentUser = currentSession?.user ?? null;

      setSession(currentSession ?? null);
      setUser(currentUser);
      await loadUserProfile(currentUser ?? null);
      if (!isMounted) return;
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true);
      const currentUser = session?.user ?? null;
      setSession(session ?? null);
      setUser(currentUser);
      await loadUserProfile(currentUser);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });
      if (error) throw error;

      const createdUser = data.user;
      if (createdUser) {
        const defaultProfile = createDefaultProfile(createdUser);
        defaultProfile.full_name = name;
        const { error: insertError } = await supabase.from('users').upsert(defaultProfile);
        if (insertError) {
          console.error('注册时创建用户信息失败', insertError);
        }
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setUserProfile(null);
      setUserRole(null);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    userRole,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
