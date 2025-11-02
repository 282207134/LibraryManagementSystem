# 部署速查指南（Start Here）

> 如果你只想快速把图书管理系统跑起来，请按照本文档完成部署。需要更详细或扩展的说明时，再参考 [`DEPLOYMENT.md`](./DEPLOYMENT.md) 等其他文档。

## 0. 环境准备

- Node.js ≥ 18（16 也可以，但推荐 18 以上）
- npm（已经随 Node.js 安装）
- 一个 Supabase 账号（免费套餐即可）

## 1. 获取代码并安装依赖

```bash
git clone <repository-url>
cd <project-directory>
npm install
```

## 2. 准备环境变量

复制示例环境变量文件并填写 Supabase 信息：

```bash
cp .env.example .env
```

在 `.env` 文件中填写以下内容（稍后在 Supabase 控制台获取）：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. 创建 Supabase 项目并启用邮箱登录

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 点击 **New project** 创建新项目，记下数据库密码
3. 在 **Authentication → Providers** 中启用 **Email** 登录

## 4. 创建数据库表与策略

在 Supabase Dashboard 打开 **SQL Editor**，执行一次下面的 SQL：

```sql
-- 启用生成 UUID 的扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 创建 books 表（如已存在可忽略）
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

-- 更新 updated_at 字段的触发器
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

-- 配置 RLS 安全策略（确保只有认证用户可以访问）
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read books" ON books;
DROP POLICY IF EXISTS "Authenticated users can insert books" ON books;
DROP POLICY IF EXISTS "Authenticated users can update books" ON books;
DROP POLICY IF EXISTS "Authenticated users can delete books" ON books;

CREATE POLICY "Authenticated users can read books" ON books
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert books" ON books
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update books" ON books
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete books" ON books
  FOR DELETE
  USING (auth.role() = 'authenticated');
```

> ✅ Supabase 会自动维护 `auth.users` 表，无需手动创建。只要启用 Email 登录即可使用注册/登录功能。

## 5. （可选）开启封面图片上传

如果需要上传图书封面图片，按照以下方式创建存储桶（可选）：

1. 在 Supabase Dashboard → **Storage** 创建名为 `book-covers` 的 public bucket
2. 在 SQL Editor 中执行 `STORAGE_SETUP.sql` 的脚本，或参考 `DEPLOYMENT.md` 中的 "Supabase Storage" 部分配置策略

没有上传需求可以跳过此步骤。

## 6. 本地启动验证

```bash
npm run dev
```

浏览器访问 `http://localhost:5173`，完成以下验证：

- 注册一个账号并登录
- 添加一本图书，确认列表显示正常
- 编辑 / 删除 / 搜索图书

## 7. 部署到线上

常用流程：

- **Vercel**：选择 Vite 模板，Build command `npm run build`，Output `dist`
- **Netlify / Render**：配置同上
- 在部署平台的环境变量中添加 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`

部署成功后，访问生成的域名验证注册、登录、增删改查是否正常。

## 8. 下一步阅读

- [完整部署详情](./DEPLOYMENT.md)：包含更多截图、可选策略以及常见问题
- [数据库设计](./DATABASE.md)：了解更多扩展表与性能建议
- [故障排除指南](./TROUBLESHOOTING.md)：遇到问题时的参考
- [扩展功能表结构建议](./SUPABASE_TABLES_PROPOSAL.md)

祝你部署顺利 🎉
