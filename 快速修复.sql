-- 如果上面的脚本执行失败，请尝试逐行执行以下命令：

-- 1. 创建函数（请确保每行之间都有换行）
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

-- 2. 删除旧策略
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can view all borrowing records" ON borrowing_records;

-- 3. 创建新策略
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can view all borrowing records" ON borrowing_records
  FOR SELECT USING (is_admin());

