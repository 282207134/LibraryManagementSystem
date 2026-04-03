import { useCallback, useEffect, useState, useRef, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { AuthContext, type AuthContextType } from './AuthContextBase';

export { AuthContext } from './AuthContextBase';

// 为新注册或缺失 users 记录的账号生成默认资料
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
  // 全局认证状态：用户、资料、角色、会话及加载态
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [userProfile, setUserProfile] = useState<AuthContextType['userProfile']>(null);
  const [userRole, setUserRole] = useState<AuthContextType['userRole']>(null);
  const [session, setSession] = useState<AuthContextType['session']>(null);
  const [loading, setLoading] = useState<AuthContextType['loading']>(true);
  // 用 ref 保存最新 user，避免 onAuthStateChange 闭包拿到旧值
  const userRef = useRef(user);

  const loadUserProfile = useCallback(
    async (supabaseUser: SupabaseUser | null) => {
      if (!supabaseUser) {
        // 未登录时清空资料与角色
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
          // 资料查询失败时不阻塞页面渲染，仅清空资料态
          setUserProfile(null);
          setUserRole(null);
          
          // 识别潜在权限问题，提示用户重新登录
          if (error.code === 'PGRST301' || error.message?.includes('permission') || 
              error.message?.includes('401') || error.message?.includes('403')) {
            console.warn('检测到权限错误，可能需要重新登录');
          }
          return;
        }

        if (data) {
          setUserProfile(data);
          setUserRole(data.role ?? 'user');
          return;
        }

        const defaultProfile = createDefaultProfile(supabaseUser);
        // users 表不存在记录时自动补一份
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

  // 更新 userRef 当 user 变化时
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      // 首次初始化保护：避免网络慢导致 loading 卡住
      const timeoutId = setTimeout(() => {
        if (isMounted) {
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

        // 读取 session 失败时降级为空会话状态
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

        // 主动检查过期时间，避免持有无效会话
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
        
        // 资料加载设置短超时，不阻塞页面首屏
        if (currentUser) {
          try {
            const profilePromise = loadUserProfile(currentUser);
            // 超时后静默放行，后续可再次刷新资料
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

    // 不处理页面可见性事件，减少切标签导致的额外抖动

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // 后台 token 刷新仅同步 session，不触发页面重算
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        setSession(session);
        return;
      }

      // 过滤重复 SIGNED_IN 事件，避免无意义 loading 闪烁
      if (event === 'SIGNED_IN' && session?.user && session.user.id === userRef.current?.id && !!userRef.current) {
        setSession(session);
        return;
      }

      // 二次保护，保证状态切换不会卡住
      const timeoutId = setTimeout(() => {
        setLoading(false);
      }, 5000);

      try {
        setLoading(true);
        const currentUser = session?.user ?? null;
        
        // 登出或会话丢失时，彻底清空本地认证状态
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
        
        // 登录后异步拉取资料，失败不影响会话本身
        if (currentUser) {
          try {
            const profilePromise = loadUserProfile(currentUser);
            const timeoutPromise = new Promise<void>((resolve) => {
              setTimeout(() => {
                // 静默超时，不显示警告
                resolve();
              }, 2000);
            });
            await Promise.race([profilePromise, timeoutPromise]);
          } catch (profileError) {
            console.error('加载用户资料时出错', profileError);
            // 明确权限错误时强制登出，避免停留在半登录状态
            if (profileError instanceof Error && 
                (profileError.message.includes('401') || 
                 profileError.message.includes('403') ||
                 profileError.message.includes('permission'))) {
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
      // 仅执行认证，资料加载由 onAuthStateChange 统一接管
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
        // 注册成功后预写 users 资料，减少首次登录额外步骤
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
      // 立即清理本地状态，让 UI 快速回到未登录态
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
