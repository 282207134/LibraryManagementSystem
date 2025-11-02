-- =====================================================
-- 修复 RLS 策略引发的无限递归问题
-- =====================================================
-- 原因：users 表的管理员策略在校验权限时再次查询 users 表
--       造成策略自身被重复触发，最终导致无限递归报错。
-- 方案：借助 SECURITY DEFINER 函数在策略外部完成管理员校验，
--       从而避免在策略内部再次访问受限的 users 表。
-- =====================================================

-- 第一步：创建安全定义函数，用于判断当前用户是否为管理员
-- 该函数以创建者权限执行，可绕过 RLS，安全地读取 users 表
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 第二步：重新创建 users 表的管理员策略，全部改用 is_admin() 校验
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update all users" ON users
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT
  WITH CHECK (is_admin());

-- 第三步：同步修复 borrowing_records 表的管理员策略
DROP POLICY IF EXISTS "Admins can view all borrowing records" ON borrowing_records;
DROP POLICY IF EXISTS "Admins can update all borrowing records" ON borrowing_records;
DROP POLICY IF EXISTS "Admins can delete borrowing records" ON borrowing_records;

CREATE POLICY "Admins can view all borrowing records" ON borrowing_records
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update all borrowing records" ON borrowing_records
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete borrowing records" ON borrowing_records
  FOR DELETE
  USING (is_admin());

-- 第四步：为 book_favorites 表补充管理员策略
DROP POLICY IF EXISTS "Admins can view all favorites" ON book_favorites;
DROP POLICY IF EXISTS "Admins can delete any favorites" ON book_favorites;

CREATE POLICY "Admins can view all favorites" ON book_favorites
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can delete any favorites" ON book_favorites
  FOR DELETE
  USING (is_admin());

-- 第五步：为 reviews 表补充管理员策略
DROP POLICY IF EXISTS "Admins can update all reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can delete all reviews" ON reviews;

CREATE POLICY "Admins can update all reviews" ON reviews
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete all reviews" ON reviews
  FOR DELETE
  USING (is_admin());

-- 第六步：允许管理员对 books 表执行任意操作
DROP POLICY IF EXISTS "Admins can manage books" ON books;

CREATE POLICY "Admins can manage books" ON books
  FOR ALL
  USING (is_admin());

-- 第七步：创建触发器函数，保证每个新认证用户都会同步到 users 表
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 第八步：绑定触发器，在 auth.users 新增记录后自动执行同步逻辑
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- 验证建议（运行脚本后可选执行以下查询）
-- =====================================================
-- SELECT * FROM users WHERE email = 'liu282207134@yahoo.co.jp';
-- SELECT is_admin(); -- 如返回 true 说明管理员判定函数工作正常
-- =====================================================
