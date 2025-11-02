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
          // 如果是 401/403/500 错误，可能是 RLS 策略或权限问题
          // 清除用户资料，但不影响页面加载
          setUserProfile(null);
          setUserRole(null);
          
          // 如果是权限错误（401/403），尝试清除 session
          if (error.code === 'PGRST301' || error.message?.includes('permission') || 
              error.message?.includes('401') || error.message?.includes('403')) {
            console.warn('检测到权限错误，可能需要重新登录');
            // 注意：这里不自动清除 session，让用户手动处理
          }
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
      // 添加超时保护，5 秒后强制结束 loading
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('初始化超时，强制结束 loading 状态');
          setLoading(false);
        }
      }, 5000);

      try {
        setLoading(true);
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) {
          clearTimeout(timeoutId);
          return;
        }

        // 如果获取 session 出错，清除状态并继续
        if (sessionError) {
          console.error('获取 session 失败', sessionError);
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setUserRole(null);
          clearTimeout(timeoutId);
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        const currentSession = data.session;
        const currentUser = currentSession?.user ?? null;

        // 验证 session 是否过期
        if (currentSession && currentSession.expires_at) {
          const expiresAt = currentSession.expires_at * 1000; // 转换为毫秒
          if (Date.now() >= expiresAt) {
            console.warn('Session 已过期，清除 session');
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setUserProfile(null);
            setUserRole(null);
            clearTimeout(timeoutId);
            if (isMounted) {
              setLoading(false);
            }
            return;
          }
        }

        setSession(currentSession ?? null);
        setUser(currentUser);
        
        // 如果有用户，尝试加载用户资料，但不要阻塞页面加载
        // 使用 Promise.race 确保不会无限等待，但不显示警告
        if (currentUser) {
          try {
            const profilePromise = loadUserProfile(currentUser);
            // 缩短超时时间，静默处理
            const timeoutPromise = new Promise<void>((resolve) => {
              setTimeout(() => {
                // 静默超时，不显示警告
                resolve();
              }, 2000);
            });
            await Promise.race([profilePromise, timeoutPromise]);
          } catch (profileError) {
            console.error('加载用户资料时出错', profileError);
            // 如果查询失败，可能是 RLS 策略问题，清除用户状态让用户重新登录
            // 但不强制清除 session，因为可能是临时的网络问题
          }
        } else {
          // 没有用户时，确保清除所有相关状态
          setUserProfile(null);
          setUserRole(null);
        }
        
        clearTimeout(timeoutId);
        if (!isMounted) return;
        setLoading(false);
      } catch (error) {
        console.error('初始化认证状态时出错', error);
        clearTimeout(timeoutId);
        // 发生错误时，清除所有状态，允许用户重新登录
        setSession(null);
        setUser(null);
        setUserProfile(null);
        setUserRole(null);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    init();

    // 完全禁用页面可见性检测，避免切换标签页时触发任何状态更新
    // visibilityHandler 已被移除，因为我们不希望在任何可见性变化时更新状态

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // TOKEN_REFRESHED 和 INITIAL_SESSION 事件不应该触发任何处理
      // 这些是后台的 token 刷新，不需要更新 UI 或重新加载用户资料
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        // 静默更新 session，不触发任何其他操作，避免页面刷新
        setSession(session);
        return;
      }

      // 添加超时保护
      const timeoutId = setTimeout(() => {
        console.warn('处理认证状态变化超时，强制结束 loading');
        setLoading(false);
      }, 5000);

      try {
        setLoading(true);
        const currentUser = session?.user ?? null;
        
        // 如果用户登出，清除所有状态
        if (event === 'SIGNED_OUT' || !session) {
          clearTimeout(timeoutId);
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setUserRole(null);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(currentUser);
        
        // 尝试加载用户资料，添加超时保护（但不显示警告）
        if (currentUser) {
          try {
            const profilePromise = loadUserProfile(currentUser);
            // 缩短超时时间，静默处理（不显示警告）
            const timeoutPromise = new Promise<void>((resolve) => {
              setTimeout(() => {
                // 静默超时，不显示警告
                resolve();
              }, 2000);
            });
            await Promise.race([profilePromise, timeoutPromise]);
          } catch (profileError) {
            console.error('加载用户资料时出错', profileError);
            // 如果是 401/403 错误，可能是权限问题，清除状态让用户重新登录
            if (profileError instanceof Error && 
                (profileError.message.includes('401') || 
                 profileError.message.includes('403') ||
                 profileError.message.includes('permission'))) {
              console.warn('权限错误，清除 session');
              await supabase.auth.signOut();
              setSession(null);
              setUser(null);
              setUserProfile(null);
              setUserRole(null);
            }
          }
        } else {
          setUserProfile(null);
          setUserRole(null);
        }
        
        clearTimeout(timeoutId);
        setLoading(false);
      } catch (error) {
        console.error('处理认证状态变化时出错', error);
        clearTimeout(timeoutId);
        setSession(null);
        setUser(null);
        setUserProfile(null);
        setUserRole(null);
        setLoading(false);
      }
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
