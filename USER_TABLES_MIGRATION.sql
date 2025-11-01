-- =====================================================
-- 用户界面数据库迁移脚本
-- 创建用户扩展表、借阅记录表、收藏表等
-- =====================================================

-- =====================================================
-- 1. users 扩展表（必须）
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  phone VARCHAR(20),
  address TEXT,
  member_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  max_borrow_limit INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 创建自动更新 updated_at 的触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 users 表创建触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;

-- 用户可以读取自己的信息
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- 用户可以更新自己的信息
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- 管理员可以读取所有用户
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 2. borrowing_records 表（必须）
-- =====================================================
CREATE TABLE IF NOT EXISTS borrowing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  borrowed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  returned_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'borrowed' 
    CHECK (status IN ('borrowed', 'returned', 'overdue', 'lost')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_borrowing_records_user_id ON borrowing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowing_records_book_id ON borrowing_records(book_id);
CREATE INDEX IF NOT EXISTS idx_borrowing_records_status ON borrowing_records(status);

-- 为 borrowing_records 表创建触发器
DROP TRIGGER IF EXISTS update_borrowing_records_updated_at ON borrowing_records;
CREATE TRIGGER update_borrowing_records_updated_at
  BEFORE UPDATE ON borrowing_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE borrowing_records ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own borrowing records" ON borrowing_records;
DROP POLICY IF EXISTS "Users can create own borrowing records" ON borrowing_records;
DROP POLICY IF EXISTS "Users can update own borrowing records" ON borrowing_records;
DROP POLICY IF EXISTS "Admins can view all borrowing records" ON borrowing_records;

-- 用户只能查看自己的借阅记录
CREATE POLICY "Users can view own borrowing records" ON borrowing_records
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能创建自己的借阅记录
CREATE POLICY "Users can create own borrowing records" ON borrowing_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的借阅记录
CREATE POLICY "Users can update own borrowing records" ON borrowing_records
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 管理员可以查看所有借阅记录
CREATE POLICY "Admins can view all borrowing records" ON borrowing_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 3. book_favorites 表（推荐）
-- =====================================================
CREATE TABLE IF NOT EXISTS book_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  favorited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_book_favorites_user_id ON book_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_book_favorites_book_id ON book_favorites(book_id);

-- RLS 策略
ALTER TABLE book_favorites ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own favorites" ON book_favorites;
DROP POLICY IF EXISTS "Users can create own favorites" ON book_favorites;
DROP POLICY IF EXISTS "Users can delete own favorites" ON book_favorites;

-- 用户只能查看自己的收藏
CREATE POLICY "Users can view own favorites" ON book_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能创建自己的收藏
CREATE POLICY "Users can create own favorites" ON book_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的收藏
CREATE POLICY "Users can delete own favorites" ON book_favorites
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 4. reviews 表（可选）
-- =====================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_reviews_book_id ON reviews(book_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

-- 为 reviews 表创建触发器
DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;

-- 所有人可以读取评论
CREATE POLICY "Anyone can read reviews" ON reviews
  FOR SELECT
  USING (true);

-- 用户只能创建自己的评论
CREATE POLICY "Users can create own reviews" ON reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的评论
CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户只能删除自己的评论
CREATE POLICY "Users can delete own reviews" ON reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 5. 借阅功能的数据库函数（推荐）
-- =====================================================

-- 借阅图书的原子操作函数
CREATE OR REPLACE FUNCTION borrow_book(
  p_user_id UUID,
  p_book_id UUID
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_current_borrowings INTEGER;
  v_available_quantity INTEGER;
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_max_borrow_limit INTEGER;
BEGIN
  -- 1. 获取用户的借阅上限
  SELECT max_borrow_limit INTO v_max_borrow_limit
  FROM users
  WHERE id = p_user_id;
  
  IF v_max_borrow_limit IS NULL THEN
    v_max_borrow_limit := 5; -- 默认值
  END IF;
  
  -- 2. 检查用户当前借阅数量
  SELECT COUNT(*) INTO v_current_borrowings
  FROM borrowing_records
  WHERE user_id = p_user_id AND status = 'borrowed';
  
  IF v_current_borrowings >= v_max_borrow_limit THEN
    RETURN json_build_object('success', false, 'error', '已达到借阅上限');
  END IF;
  
  -- 3. 检查图书可借数量
  SELECT available_quantity INTO v_available_quantity
  FROM books
  WHERE id = p_book_id;
  
  IF v_available_quantity IS NULL THEN
    RETURN json_build_object('success', false, 'error', '图书不存在');
  END IF;
  
  IF v_available_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', '该图书暂无可借库存');
  END IF;
  
  -- 4. 检查是否已借阅此书
  IF EXISTS (
    SELECT 1 FROM borrowing_records
    WHERE user_id = p_user_id AND book_id = p_book_id AND status = 'borrowed'
  ) THEN
    RETURN json_build_object('success', false, 'error', '您已借阅此书');
  END IF;
  
  -- 5. 计算到期日期（30天后）
  v_due_date := NOW() + INTERVAL '30 days';
  
  -- 6. 创建借阅记录
  INSERT INTO borrowing_records (book_id, user_id, due_date, status)
  VALUES (p_book_id, p_user_id, v_due_date, 'borrowed');
  
  -- 7. 更新图书可借数量
  UPDATE books
  SET available_quantity = available_quantity - 1
  WHERE id = p_book_id;
  
  RETURN json_build_object('success', true, 'due_date', v_due_date);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 归还图书的原子操作函数
CREATE OR REPLACE FUNCTION return_book(
  p_borrowing_id UUID
) RETURNS JSON AS $$
DECLARE
  v_book_id UUID;
  v_user_id UUID;
BEGIN
  -- 1. 获取借阅记录信息并更新状态
  UPDATE borrowing_records
  SET returned_at = NOW(),
      status = 'returned'
  WHERE id = p_borrowing_id
    AND status = 'borrowed'
  RETURNING book_id, user_id INTO v_book_id, v_user_id;
  
  IF v_book_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', '借阅记录不存在或已归还');
  END IF;
  
  -- 2. 更新图书可借数量
  UPDATE books
  SET available_quantity = available_quantity + 1
  WHERE id = v_book_id;
  
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 标记逾期借阅记录的函数
CREATE OR REPLACE FUNCTION mark_overdue_borrowings()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE borrowing_records
  SET status = 'overdue'
  WHERE status = 'borrowed'
    AND due_date < NOW()
    AND returned_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 完成提示
-- =====================================================
-- 迁移完成！
-- 接下来需要：
-- 1. 在 Supabase Dashboard 运行此 SQL 脚本
-- 2. 确保 books 表已存在
-- 3. 手动创建第一个管理员账户（在 users 表中设置 role = 'admin'）
