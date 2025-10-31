# 数据库设计文档

## 概述

本项目使用 Supabase 作为后端数据库和 API 服务。数据库采用 PostgreSQL。

## 数据表结构

### books 表

图书信息表，用于存储所有图书的详细信息。

#### 字段说明

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | UUID | PRIMARY KEY | `gen_random_uuid()` | 图书唯一标识符 |
| `title` | VARCHAR(255) | NOT NULL | - | 图书标题 |
| `author` | VARCHAR(255) | NOT NULL | - | 作者 |
| `isbn` | VARCHAR(13) | UNIQUE | NULL | 国际标准书号（10或13位） |
| `publisher` | VARCHAR(255) | - | NULL | 出版社 |
| `publication_year` | INTEGER | - | NULL | 出版年份 |
| `category` | VARCHAR(100) | - | NULL | 图书分类 |
| `description` | TEXT | - | NULL | 图书简介 |
| `quantity` | INTEGER | - | 1 | 库存总数量 |
| `available_quantity` | INTEGER | - | 1 | 可借数量 |
| `cover_image_url` | TEXT | - | NULL | 封面图片 URL |
| `created_at` | TIMESTAMP WITH TIME ZONE | - | `NOW()` | 记录创建时间 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | - | `NOW()` | 记录最后更新时间 |

#### 创建表的 SQL 脚本

```sql
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(13) UNIQUE,
  publisher VARCHAR(255),
  publication_year INTEGER,
  category VARCHAR(100),
  description TEXT,
  quantity INTEGER DEFAULT 1,
  available_quantity INTEGER DEFAULT 1,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 索引

为了优化查询性能，创建了以下索引：

```sql
-- 书名索引（支持书名搜索）
CREATE INDEX idx_books_title ON books(title);

-- 作者索引（支持作者搜索）
CREATE INDEX idx_books_author ON books(author);

-- 分类索引（支持分类筛选）
CREATE INDEX idx_books_category ON books(category);
```

#### 约束说明

1. **主键约束**：`id` 字段作为主键，自动生成 UUID
2. **非空约束**：`title` 和 `author` 字段不能为空
3. **唯一约束**：`isbn` 字段必须唯一（如果提供）
4. **业务逻辑约束**：
   - `available_quantity` 应小于或等于 `quantity`
   - `publication_year` 应在合理范围内（1000-9999）
   - `isbn` 应为10位或13位数字

## Row Level Security (RLS) 策略

### 开发环境（初期）

在开发阶段，可以暂时禁用 RLS 以便快速开发和测试：

```sql
-- 禁用 RLS
ALTER TABLE books DISABLE ROW LEVEL SECURITY;
```

或者设置为公开访问：

```sql
-- 启用 RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取
CREATE POLICY "Allow public read access" ON books
  FOR SELECT USING (true);

-- 允许所有人插入
CREATE POLICY "Allow public insert access" ON books
  FOR INSERT WITH CHECK (true);

-- 允许所有人更新
CREATE POLICY "Allow public update access" ON books
  FOR UPDATE USING (true);

-- 允许所有人删除
CREATE POLICY "Allow public delete access" ON books
  FOR DELETE USING (true);
```

### 生产环境（推荐）

在生产环境中，建议启用适当的 RLS 策略以保护数据安全。以下是基于用户认证的示例策略：

```sql
-- 启用 RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 允许已认证用户读取所有图书
CREATE POLICY "Authenticated users can read all books" ON books
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 只有管理员可以插入图书
CREATE POLICY "Only admins can insert books" ON books
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- 只有管理员可以更新图书
CREATE POLICY "Only admins can update books" ON books
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

-- 只有管理员可以删除图书
CREATE POLICY "Only admins can delete books" ON books
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');
```

## 用户认证说明

### 基础认证

本项目使用 Supabase Auth 进行用户认证。Supabase 会自动维护 `auth.users` 表，包含用户的基本账号信息（email, password_hash 等）。开发者无需手动创建或管理此表，只需通过 Supabase Dashboard 启用相应的登录方式即可（例如 Email 登录）。

### 当前实现

- 项目已实现基于 Supabase Auth 的登录、注册功能
- 所有用户认证都由 `auth.users` 表自动处理
- 前端通过 Supabase Client 调用 `signUp()` 和 `signIn()` 方法完成认证

### 扩展用户资料（可选）

如果需要在 `auth.users` 之外存储额外的用户资料（如角色、电话、地址等），可以创建一个扩展表与 `auth.users` 一对一关联：

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'librarian')),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**注意**：上述扩展表并非当前项目必需，仅在需要额外字段时才创建。详细建表 SQL 和 RLS 策略请参考 [SUPABASE_TABLES_PROPOSAL.md](./SUPABASE_TABLES_PROPOSAL.md)。

## 未来扩展建议

### 1. 借阅记录系统

添加借阅记录表，跟踪图书借阅情况。注意：此表引用的 `user_id` 可以直接使用 `auth.users(id)`，也可以使用扩展的 `users` 表：

```sql
CREATE TABLE borrowing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- 或 REFERENCES users(id)
  borrowed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  returned_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'borrowed', -- 'borrowed', 'returned', 'overdue'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_borrowing_records_book_id ON borrowing_records(book_id);
CREATE INDEX idx_borrowing_records_user_id ON borrowing_records(user_id);
CREATE INDEX idx_borrowing_records_status ON borrowing_records(status);
```

### 2. 图书封面

图书封面图片功能已集成到系统中。`cover_image_url` 字段已包含在 books 表中，用于存储图片 URL 地址。

如果需要使用 Supabase Storage 存储图片，可以创建存储桶：
- 在 Supabase Dashboard 中创建 public bucket 名为 `book-covers`
- 设置为公开访问以便前端直接展示图片

### 3. 图书评分和评论

添加评分和评论功能：

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- 或 REFERENCES users(id)
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_book_id ON reviews(book_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
```

### 4. 图书库存历史

跟踪图书库存变化：

```sql
CREATE TABLE inventory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'add', 'remove', 'borrow', 'return'
  quantity_change INTEGER NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id), -- 或 REFERENCES users(id)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_history_book_id ON inventory_history(book_id);
```

## 数据维护

### 自动更新 updated_at 字段

创建触发器自动更新 `updated_at` 字段：

```sql
-- 创建更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 books 表创建触发器
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 数据备份

建议定期备份数据库：

1. 使用 Supabase Dashboard 的备份功能
2. 或使用 pg_dump 命令手动备份：
   ```bash
   pg_dump -h your-db-host -U postgres -d postgres > backup.sql
   ```

## 性能优化建议

1. **索引优化**：根据实际查询模式添加合适的索引
2. **分页查询**：使用 LIMIT 和 OFFSET 进行分页，避免一次性加载大量数据
3. **缓存策略**：对频繁查询的数据实施缓存
4. **定期清理**：删除过期或无用的数据
5. **查询优化**：使用 EXPLAIN ANALYZE 分析慢查询并优化

## 安全建议

1. **启用 RLS**：在生产环境中必须启用 Row Level Security
2. **最小权限原则**：只授予必要的数据库权限
3. **输入验证**：在应用层验证所有用户输入
4. **敏感数据加密**：对敏感信息进行加密存储
5. **定期审计**：定期检查数据库访问日志
