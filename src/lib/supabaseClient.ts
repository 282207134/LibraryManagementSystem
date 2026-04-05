import { createClient } from '@supabase/supabase-js';

// 统一从 Vite 环境变量读取 Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
/** 本地调试 Edge Function 时设为 http://127.0.0.1:54321/functions/v1（需另开 `npm run supabase:functions:serve`） */
const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // 在应用初始化阶段直接失败，避免后续请求才暴露配置问题
  throw new Error(
    'Missing Supabase configuration. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.'
  );
}

// 全局唯一 Supabase 客户端，供 hooks / context 复用
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  ...(functionsUrl
    ? { functions: { url: functionsUrl.replace(/\/$/, '') } }
    : {}),
});
