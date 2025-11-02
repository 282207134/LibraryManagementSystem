# 📦 部署指南（一站式）

> 本指南包含从零开始部署图书管理系统的所有步骤，10分钟内完成！

## 🚀 快速部署（3步搞定）

### 第一步：准备代码

```bash
git clone <repository-url>
cd <project-directory>
npm install
cp .env.example .env
```

### 第二步：配置 Supabase

#### 2.1 创建项目

1. 访问 [Supabase](https://app.supabase.com) 并登录
2. 点击 **New project**
3. 填写项目名称和数据库密码，选择区域，点击创建

#### 2.2 获取环境变量

1. 在 Supabase Dashboard 点击上方的 **Connect**
2. 复制 **Project URL** 和 **anon public** key
3. 填入 `.env` 文件：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

#### 2.3 启用用户认证

1. 在 Supabase Dashboard 点击 **Authentication** → **Providers**
2. 启用 **Email** 登录方式
3. （开发环境）在 **Settings** 中可以禁用邮件确认

#### 2.4 创建数据库表

在 Supabase Dashboard 点击 **SQL Editor**，执行以下 SQL（**一次性复制全部**）：

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

-- 创建索引（提升查询性能）
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);

-- 自动更新时间戳函数
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

-- 启用 RLS（行级安全）
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Authenticated users can read books" ON books;
DROP POLICY IF EXISTS "Authenticated users can insert books" ON books;
DROP POLICY IF EXISTS "Authenticated users can update books" ON books;
DROP POLICY IF EXISTS "Authenticated users can delete books" ON books;

-- 创建新策略（只有登录用户可以操作）
CREATE POLICY "Authenticated users can read books" ON books
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert books" ON books
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update books" ON books
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete books" ON books
  FOR DELETE USING (auth.role() = 'authenticated');
```

### 第三步：启动和部署

#### 本地运行

```bash
npm run dev
```

访问 `http://localhost:5173`，测试注册、登录、添加图书等功能。

#### 部署到线上（推荐 Vercel）

1. 将代码推送到 GitHub
2. 访问 [Vercel](https://vercel.com) 并导入项目
3. 设置：
   - Framework: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. 添加环境变量：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. 点击 **Deploy**

---

## 📸 图片上传功能（可选）

如果需要上传图书封面，执行以下步骤：

### 1. 创建存储桶

1. 在 Supabase Dashboard 点击 **Storage**
2. 点击 **New bucket**
3. 名称填写：`book-covers`
4. 勾选 **Public bucket**
5. 点击 **Create**

### 2. 配置存储策略

在 SQL Editor 中执行：

```sql
-- 允许已认证用户上传
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'book-covers');

-- 允许已认证用户更新
CREATE POLICY "Allow authenticated users to update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'book-covers');

-- 允许已认证用户删除
CREATE POLICY "Allow authenticated users to delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'book-covers');

-- 允许所有人查看（公开读取）
CREATE POLICY "Allow public to read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'book-covers');
```

---

## 🔧 常见问题

### 无法登录/注册？

- 确认 Supabase 的 **Email** 登录已启用
- 检查 `.env` 文件配置是否正确
- 重启开发服务器：`npm run dev`

### 数据无法加载？

- 确认 SQL 脚本已完整执行
- 检查 RLS 策略是否正确
- 在 Supabase Dashboard 查看日志（Logs 菜单）

### 图片上传失败？

- 确认存储桶 `book-covers` 已创建并设为 public
- 确认存储策略已配置
- 查看浏览器控制台的错误信息

### 需要更多帮助？

参考 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 获取详细的故障排查指南。

---

## 📊 数据库说明

### books 表字段

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

### 用户认证

- 用户数据由 Supabase Auth 自动管理（`auth.users` 表）
- 无需手动创建用户表
- 注册的用户会自动保存

---

## 🎯 总结

完整的部署检查清单：

- [x] 安装依赖和配置环境变量
- [x] 创建 Supabase 项目
- [x] 启用 Email 认证
- [x] 执行数据库 SQL 脚本
- [x] 本地测试功能
- [x] 部署到线上平台
- [x] （可选）配置图片上传

**恭喜！你的图书管理系统已经部署完成！** 🎉
