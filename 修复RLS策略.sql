-- =====================================================
-- 修复 RLS 策略引发的 500 错误和管理员权限问题
-- 请完整复制此文件的所有内容到 Supabase SQL Editor 执行
-- =====================================================

-- 创建 is_admin() 函数
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 修复 users 表的管理员策略
DROP POLICY IF EXISTS "Admins can read all users" ON users;

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT USING (is_admin());

-- 修复 borrowing_records 表的管理员策略
DROP POLICY IF EXISTS "Admins can view all borrowing records" ON borrowing_records;

CREATE POLICY "Admins can view all borrowing records" ON borrowing_records
  FOR SELECT USING (is_admin());

-- =====================================================
-- 完成！请刷新浏览器页面并重新登录
-- =====================================================
