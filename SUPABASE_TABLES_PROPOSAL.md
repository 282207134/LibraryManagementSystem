# Supabase 数据表创建方案

## 项目概述
本文档提供了图书管理系统在 Supabase 中需要创建的所有数据表的详细说明和 SQL 脚本。

---

## 用户与认证说明

- Supabase Auth 会自动创建并维护 `auth.users` 表，用于存储所有注册用户的基础账号信息。对于当前项目的核心功能，只需在 Supabase Dashboard 中启用 Email 登录（或其他需要的登录方式），即可获得完整的认证能力，无需手动创建额外的用户表。
- 如果需要在 `auth.users` 基础上扩展更多资料字段（如角色、联系方式等），可以创建一个与 `auth.users` 一对一关联的扩展表。该扩展表的示例 SQL 见下文的「users 表 - 用户信息扩展表（可选）」章节。
- 其他引用用户数据的表（例如借阅记录、评论等）可以直接引用 `auth.users(id)`，也可以引用扩展的 `users(id)`，视实际需求而定。

## 核心表（必须创建）

### 1. books 表 - 图书信息表

**用途**: 存储所有图书的详细信息

**完整 SQL 创建脚本**:

```sql
-- 创建 books 表
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(13) UNIQUE,
  publisher VARCHAR(255),
  publication_year INTEGER,
  category VARCHAR(100),
  description TEXT,
  quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
  available_quantity INTEGER DEFAULT 1 CHECK (available_quantity >= 0),
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加约束：可借数量不能大于库存数量
ALTER TABLE books ADD CONSTRAINT chk_available_quantity 
  CHECK (available_quantity <= quantity);

-- 创建索引以优化查询性能
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_category ON books(category);
CREATE INDEX idx_books_isbn ON books(isbn);

-- 创建自动更新 updated_at 的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 配置 Row Level Security (RLS)
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 允许已认证用户读取所有图书
CREATE POLICY "Authenticated users can read books" ON books
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 允许已认证用户添加图书
CREATE POLICY "Authenticated users can insert books" ON books
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 允许已认证用户更新图书
CREATE POLICY "Authenticated users can update books" ON books
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 允许已认证用户删除图书
CREATE POLICY "Authenticated users can delete books" ON books
  FOR DELETE
  USING (auth.role() = 'authenticated');
```

**字段说明**:

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 自动生成的唯一标识符 |
| title | VARCHAR(255) | NOT NULL | 图书名称 |
| author | VARCHAR(255) | NOT NULL | 作者姓名 |
| isbn | VARCHAR(13) | UNIQUE | 国际标准书号(10或13位) |
| publisher | VARCHAR(255) | - | 出版社名称 |
| publication_year | INTEGER | - | 出版年份 |
| category | VARCHAR(100) | - | 图书分类(如:小说、科技、历史等) |
| description | TEXT | - | 图书简介/内容描述 |
| quantity | INTEGER | >= 0 | 图书库存总数 |
| available_quantity | INTEGER | >= 0, <= quantity | 可借阅数量 |
| cover_image_url | TEXT | - | 封面图片URL地址 |
| created_at | TIMESTAMP | - | 记录创建时间 |
| updated_at | TIMESTAMP | - | 记录更新时间 |

---

## 扩展表（可选，用于完整的图书管理系统）

### 2. users 表 - 用户信息扩展表（可选）

**用途**: 扩展 Supabase Auth 的用户信息，存储额外的用户资料（如角色、电话、地址、借阅限制等）

> **说明**：此表并非必需。如果项目仅需要 Supabase Auth 提供的 email 与 password 认证功能，可以不创建此表，直接使用 `auth.users`。只有在需要额外字段时才创建此表。

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'librarian')),
  phone VARCHAR(20),
  address TEXT,
  member_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  max_borrow_limit INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 创建更新触发器
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

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
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 关联 auth.users 的主键 |
| email | VARCHAR(255) | 用户邮箱 |
| full_name | VARCHAR(255) | 用户全名 |
| role | VARCHAR(50) | 用户角色(user/admin/librarian) |
| phone | VARCHAR(20) | 联系电话 |
| address | TEXT | 联系地址 |
| member_since | TIMESTAMP | 成为会员的日期 |
| max_borrow_limit | INTEGER | 最大借阅数量限制 |

---

### 3. borrowing_records 表 - 借阅记录表

**用途**: 跟踪图书借阅、归还情况

> **注意**：此表中的 `user_id` 引用的是扩展表 `users(id)`。如果你没有创建扩展表，可以改为 `REFERENCES auth.users(id)`；同时 RLS 策略中访问 `users` 表的地方也需要相应调整或简化。

```sql
CREATE TABLE borrowing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 或 auth.users(id)

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
CREATE INDEX idx_borrowing_records_book_id ON borrowing_records(book_id);
CREATE INDEX idx_borrowing_records_user_id ON borrowing_records(user_id);
CREATE INDEX idx_borrowing_records_status ON borrowing_records(status);
CREATE INDEX idx_borrowing_records_due_date ON borrowing_records(due_date);

-- 创建更新触发器
CREATE TRIGGER update_borrowing_records_updated_at
  BEFORE UPDATE ON borrowing_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE borrowing_records ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的借阅记录
CREATE POLICY "Users can read own records" ON borrowing_records
  FOR SELECT
  USING (auth.uid() = user_id);

-- 管理员和图书管理员可以查看所有借阅记录
CREATE POLICY "Staff can read all records" ON borrowing_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'librarian')
    )
  );

-- 管理员和图书管理员可以创建借阅记录
CREATE POLICY "Staff can insert records" ON borrowing_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'librarian')
    )
  );

-- 管理员和图书管理员可以更新借阅记录
CREATE POLICY "Staff can update records" ON borrowing_records
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'librarian')
    )
  );
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 借阅记录唯一标识 |
| book_id | UUID | 关联的图书ID |
| user_id | UUID | 借阅用户ID |
| borrowed_at | TIMESTAMP | 借阅时间 |
| due_date | TIMESTAMP | 应归还时间 |
| returned_at | TIMESTAMP | 实际归还时间 |
| status | VARCHAR(50) | 状态(borrowed/returned/overdue/lost) |
| notes | TEXT | 备注信息 |

---

### 4. reviews 表 - 图书评价表

**用途**: 允许用户对图书进行评分和评论

> **注意**：此表的 `user_id` 同样引用了扩展表 `users(id)`。如未创建扩展表，可改为 `REFERENCES auth.users(id)`。

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 或 auth.users(id)

  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(book_id, user_id) -- 每个用户对每本书只能评论一次
);

-- 创建索引
CREATE INDEX idx_reviews_book_id ON reviews(book_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- 创建更新触发器
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 所有已认证用户可以查看评论
CREATE POLICY "Authenticated users can read reviews" ON reviews
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 用户可以创建自己的评论
CREATE POLICY "Users can insert own reviews" ON reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的评论
CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户可以删除自己的评论
CREATE POLICY "Users can delete own reviews" ON reviews
  FOR DELETE
  USING (auth.uid() = user_id);
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 评论唯一标识 |
| book_id | UUID | 关联的图书ID |
| user_id | UUID | 评论用户ID |
| rating | INTEGER | 评分(1-5星) |
| comment | TEXT | 评论内容 |
| helpful_count | INTEGER | 有帮助的点赞数 |

---

### 5. reservations 表 - 图书预约表

**用途**: 当图书被借出时，其他用户可以预约，归还后优先借阅

> **注意**：此表默认引用扩展表 `users(id)`，如未创建扩展表，可改为 `REFERENCES auth.users(id)`。

```sql
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 或 auth.users(id)
  reserved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'active' 
    CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired')),
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_reservations_book_id ON reservations(book_id);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_status ON reservations(status);

-- 创建更新触发器
CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reservations" ON reservations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reservations" ON reservations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can read all reservations" ON reservations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'librarian')
    )
  );
```

---

### 6. notifications 表 - 通知表

**用途**: 系统通知(逾期提醒、预约通知等)

> **注意**：此表同样默认引用扩展表 `users(id)`，如未创建扩展表，可改为 `REFERENCES auth.users(id)`。

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 或 auth.users(id)
  type VARCHAR(50) NOT NULL 
    CHECK (type IN ('due_soon', 'overdue', 'reservation_ready', 'system')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  related_book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  related_record_id UUID REFERENCES borrowing_records(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);

-- RLS 策略
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);
```

---

## 存储桶（Storage Buckets）

### book-covers 存储桶

用于存储图书封面图片

**创建步骤**:
1. 在 Supabase Dashboard 中进入 **Storage**
2. 点击 **New bucket**
3. 名称: `book-covers`
4. 设置为 **Public** (公开访问)
5. 配置策略:

```sql
-- 允许已认证用户上传图片
CREATE POLICY "Authenticated users can upload book covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'book-covers');

-- 允许所有人查看图片(因为设置为public，这个策略是可选的)
CREATE POLICY "Anyone can view book covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'book-covers');
```

---

## 视图（Views）- 可选但推荐

### book_statistics 视图 - 图书统计信息

```sql
CREATE OR REPLACE VIEW book_statistics AS
SELECT 
  b.id,
  b.title,
  b.author,
  COUNT(DISTINCT br.id) as total_borrows,
  AVG(r.rating) as average_rating,
  COUNT(DISTINCT r.id) as review_count,
  COUNT(DISTINCT CASE WHEN br.status = 'borrowed' THEN br.id END) as current_borrows
FROM books b
LEFT JOIN borrowing_records br ON b.id = br.book_id
LEFT JOIN reviews r ON b.id = r.book_id
GROUP BY b.id, b.title, b.author;
```

### user_borrowing_stats 视图 - 用户借阅统计

```sql
CREATE OR REPLACE VIEW user_borrowing_stats AS
SELECT 
  u.id,
  u.full_name,
  u.email,
  COUNT(DISTINCT br.id) as total_borrows,
  COUNT(DISTINCT CASE WHEN br.status = 'borrowed' THEN br.id END) as active_borrows,
  COUNT(DISTINCT CASE WHEN br.status = 'overdue' THEN br.id END) as overdue_count
FROM users u
LEFT JOIN borrowing_records br ON u.id = br.user_id
GROUP BY u.id, u.full_name, u.email;
```

---

## 数据库函数（Database Functions）

### 借书操作函数

```sql
CREATE OR REPLACE FUNCTION borrow_book(
  p_book_id UUID,
  p_user_id UUID,
  p_days INTEGER DEFAULT 14
)
RETURNS UUID AS $$
DECLARE
  v_record_id UUID;
  v_available INTEGER;
BEGIN
  -- 检查库存
  SELECT available_quantity INTO v_available 
  FROM books WHERE id = p_book_id;
  
  IF v_available <= 0 THEN
    RAISE EXCEPTION 'Book is not available';
  END IF;
  
  -- 减少可借数量
  UPDATE books 
  SET available_quantity = available_quantity - 1 
  WHERE id = p_book_id;
  
  -- 创建借阅记录
  INSERT INTO borrowing_records (book_id, user_id, due_date)
  VALUES (p_book_id, p_user_id, NOW() + (p_days || ' days')::INTERVAL)
  RETURNING id INTO v_record_id;
  
  RETURN v_record_id;
END;
$$ LANGUAGE plpgsql;
```

### 还书操作函数

```sql
CREATE OR REPLACE FUNCTION return_book(p_record_id UUID)
RETURNS VOID AS $$
DECLARE
  v_book_id UUID;
BEGIN
  -- 获取图书ID
  SELECT book_id INTO v_book_id 
  FROM borrowing_records 
  WHERE id = p_record_id;
  
  -- 更新借阅记录
  UPDATE borrowing_records 
  SET returned_at = NOW(), status = 'returned'
  WHERE id = p_record_id;
  
  -- 增加可借数量
  UPDATE books 
  SET available_quantity = available_quantity + 1 
  WHERE id = v_book_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 快速开始脚本

将以下完整脚本复制到 Supabase SQL Editor 中一次性执行:

```sql
-- ================================
-- 最小可运行版本 (仅 books 表)
-- ================================

-- 创建 books 表
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(13) UNIQUE,
  publisher VARCHAR(255),
  publication_year INTEGER,
  category VARCHAR(100),
  description TEXT,
  quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
  available_quantity INTEGER DEFAULT 1 CHECK (available_quantity >= 0 AND available_quantity <= quantity),
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);

-- 创建自动更新函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS update_books_updated_at ON books;
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用 RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "Authenticated users can read books" ON books;
DROP POLICY IF EXISTS "Authenticated users can insert books" ON books;
DROP POLICY IF EXISTS "Authenticated users can update books" ON books;
DROP POLICY IF EXISTS "Authenticated users can delete books" ON books;

-- 创建新策略
CREATE POLICY "Authenticated users can read books" ON books
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert books" ON books
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update books" ON books
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete books" ON books
  FOR DELETE USING (auth.role() = 'authenticated');
```

---

## 配置步骤

### 1. Supabase 认证设置

1. 进入 Supabase Dashboard → **Authentication** → **Providers**
2. 启用 **Email** 认证
3. 配置邮件模板(可选)
4. 禁用 **Confirm email** (开发阶段可选)

### 2. 执行 SQL 脚本

**选项 A: 最小版本(仅核心功能)**
- 执行上面的"快速开始脚本"
- 只创建 books 表

**选项 B: 完整版本(包含所有功能)**
- 依次执行本文档中所有表的创建脚本
- 按顺序: books → users → borrowing_records → reviews → reservations → notifications
- 执行视图和函数脚本

### 3. 创建测试数据(可选)

```sql
-- 插入测试图书
INSERT INTO books (title, author, isbn, publisher, publication_year, category, description, quantity, available_quantity)
VALUES 
  ('三体', '刘慈欣', '9787536692930', '重庆出版社', 2008, '科幻', '地球文明向宇宙发出第一声啼鸣', 5, 5),
  ('活着', '余华', '9787506365437', '作家出版社', 2012, '小说', '一个关于生存的故事', 3, 3),
  ('百年孤独', '加西亚·马尔克斯', '9787544253994', '南海出版公司', 2011, '文学', '魔幻现实主义代表作', 4, 4);
```

---

## 总结

### 立即需要创建的表:
1. ✅ **books** - 图书信息表 (必须)

### 推荐在功能扩展时创建:
2. **users** - 用户扩展信息表
3. **borrowing_records** - 借阅记录表
4. **reviews** - 图书评价表
5. **reservations** - 图书预约表
6. **notifications** - 通知表

### 建议的开发顺序:
1. **阶段1**: books 表 → 实现基本的图书CRUD
2. **阶段2**: users 表 → 完善用户信息和权限
3. **阶段3**: borrowing_records 表 → 添加借阅功能
4. **阶段4**: reviews + reservations + notifications → 完善用户体验

---

## 参考资源

- [Supabase 官方文档](https://supabase.com/docs)
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Row Level Security 指南](https://supabase.com/docs/guides/auth/row-level-security)
