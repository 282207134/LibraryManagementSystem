# 📚 图书管理系统

基于 **React + TypeScript + Supabase** 构建的现代化图书管理系统。

---

## ✨ 功能特性

- 用户注册、登录与会话管理（Supabase Auth）
- 图书的增删改查与分页搜索
- 响应式设计，支持移动端
- 图书封面上传（可选）

---

## 🛠 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **后端**：Supabase (PostgreSQL + Auth + Storage)

---

## 🚀 快速部署（10分钟）

### 第一步：准备代码

```bash
git clone <repository-url>
cd <project-directory>
npm install
cp .env.example .env
```

### 第二步：配置 Supabase

#### 1. 创建项目

访问 [Supabase](https://app.supabase.com)，创建新项目。

#### 2. 配置环境变量

在项目 Dashboard 点击 **Connect**，复制 URL 和 anon key，填入 `.env`：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

#### 3. 启用 Email 认证

在 **Authentication** → **Providers** 中启用 **Email** 登录。

#### 4. 创建数据库表

在 **SQL Editor** 执行以下 SQL：

```sql
-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 创建图书表
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
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);

-- 自动更新时间戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_books_updated_at ON books;
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全（RLS）
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "Authenticated users can read books" ON books;
DROP POLICY IF EXISTS "Authenticated users can insert books" ON books;
DROP POLICY IF EXISTS "Authenticated users can update books" ON books;
DROP POLICY IF EXISTS "Authenticated users can delete books" ON books;

-- 创建新策略（只允许登录用户操作）
CREATE POLICY "Authenticated users can read books" ON books
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert books" ON books
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update books" ON books
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete books" ON books
  FOR DELETE USING (auth.role() = 'authenticated');
```

### 第三步：运行

```bash
npm run dev
```

访问 `http://localhost:5173`，注册账号即可使用。

---

## 📸 图片上传配置（可选）

如需上传图书封面：

### 1. 创建存储桶

在 **Storage** 中创建名为 `book-covers` 的 **public** 存储桶。

### 2. 配置存储策略

在 SQL Editor 执行：

```sql
-- 允许已认证用户上传/更新/删除
CREATE POLICY "Allow authenticated upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'book-covers');

CREATE POLICY "Allow authenticated update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'book-covers');

CREATE POLICY "Allow authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'book-covers');

-- 允许公开读取
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'book-covers');
```

> 其他可选 SQL 脚本位于 [`docs/sql`](./docs/sql) 目录，包含迁移、借阅功能和 RLS 修复等进阶场景说明。

---

## 🌐 部署到线上（推荐 Vercel）

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置：
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Framework: Vite
4. 添加环境变量：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. 部署

---

## 🔧 常见问题

### 无法注册/登录？

- 确认 Supabase Email 登录已启用
- 检查 `.env` 配置是否正确
- 重启开发服务器

### 数据无法加载？

- 确认 SQL 脚本已完整执行
- 检查 RLS 策略是否配置
- 确保已登录（RLS 要求认证用户）

### 图片上传失败？

- 确认存储桶 `book-covers` 已创建并设为 public
- 确认存储策略已配置
- 检查浏览器控制台错误信息

### 本地正常，部署后异常？

- 检查部署平台的环境变量配置
- 触发重新部署
- 查看构建日志

---

## 🧪 可用脚本

```bash
npm run dev      # 开发模式
npm run build    # 构建生产版本
npm run preview  # 预览生产构建
npm run lint     # ESLint 检查
```

---

## 📊 数据库表结构

### books 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键，自动生成 |
| title | VARCHAR(255) | 书名（必填） |
| author | VARCHAR(255) | 作者（必填） |
| isbn | VARCHAR(13) | ISBN 编号（唯一） |
| publisher | VARCHAR(255) | 出版社 |
| publication_year | INTEGER | 出版年份 |
| category | VARCHAR(100) | 分类 |
| description | TEXT | 简介 |
| quantity | INTEGER | 库存总数 |
| available_quantity | INTEGER | 可借数量 |
| cover_image_url | TEXT | 封面图片 URL |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

---

## 📜 许可证

MIT License
