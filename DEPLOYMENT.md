# 部署指南

本文档介绍如何部署基于 React + Supabase 的图书管理系统，包括 Supabase 项目配置、数据库表创建、用户认证设置、RLS 策略以及前端部署流程。

---

## 快速开始摘要

完整部署流程分为以下几个步骤：

1. ✅ **创建 Supabase 项目** (必需)
2. ✅ **启用用户认证** (必需) - Supabase 自动处理用户表，无需手动创建
3. ✅ **创建 books 数据表** (必需) - 运行核心 SQL 脚本
4. ✅ **配置 RLS 策略** (必需) - 设置数据访问权限
5. ✅ **配置环境变量** (必需) - 获取 API Key 和 URL
6. ✅ **部署前端应用** (必需) - Vercel/Netlify 等平台

> **💡 重要提示**：本项目的用户注册和登录功能由 **Supabase Auth** 自动处理。Supabase 会自动创建和维护 `auth.users` 系统表，**无需手动创建任何用户表**。您只需在 Supabase Dashboard 中启用 Email 登录即可。

---

## 1. 创建 Supabase 项目

1. 访问 [Supabase 官网](https://supabase.com/)，登录或注册账号。
2. 点击 **New project** 创建新项目。
3. 填写项目信息：
   - **Project name**: 例如 `books-management`
   - **Database Password**: 设置数据库密码（请妥善保存）
   - **Region**: 选择离用户最近的区域
4. 点击 **Create new project**，等待 Supabase 初始化完成（约 2 分钟）。

## 2. 启用用户认证

### 2.1 启用 Email 登录

1. 在 Supabase 控制台，点击左侧的 **Authentication**。
2. 点击 **Providers** 选项卡。
3. 找到 **Email** 提供商，点击启用。
4. 根据需要配置邮件模板和确认设置：
   - **Enable email confirmations**: 开发环境可以禁用，生产环境建议启用
   - **Secure email change**: 建议启用
5. 点击 **Save** 保存设置。

### 2.2 关于用户表的说明

**重要**：Supabase Auth 会自动创建和维护一个名为 `auth.users` 的系统表，用于存储所有注册用户的账号信息（email、password_hash 等）。

- ✅ **无需手动创建用户表** - `auth.users` 表由 Supabase 自动管理
- ✅ **注册和登录已内置** - 前端直接调用 `supabase.auth.signUp()` 和 `signInWithPassword()` 即可
- ✅ **用户数据自动存储** - 所有注册的用户会自动存储在 `auth.users` 表中

**可选扩展**：如果您需要存储额外的用户资料（如角色、手机号、地址等），可以创建一个扩展表。参考 [SUPABASE_TABLES_PROPOSAL.md](./SUPABASE_TABLES_PROPOSAL.md) 中的 `users` 表示例。但对于当前项目的核心功能，这不是必需的。

### 2.3 测试用户认证

在 Supabase Dashboard 中可以手动创建测试用户：

1. 进入 **Authentication** → **Users**
2. 点击 **Add user** → **Create new user**
3. 输入 Email 和 Password
4. 点击 **Create user**

您也可以在应用的注册页面直接注册新用户。

---

## 3. 创建数据库表

### 3.1 执行核心 SQL（books 表）

1. 在 Supabase 控制台，点击左侧的 **SQL**。
2. 创建新查询，将以下脚本完整复制并执行一次：

```sql
-- 启用生成 UUID 所需的扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 创建图书信息表（带封面与库存约束）
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

-- 常用索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);

-- 自动维护 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

> 如果您之前已经创建过 `books` 表（例如在初始化项目时运行过旧脚本），可直接跳过本步骤。

### 3.2 （可选）创建用户资料扩展表

如需在 `auth.users` 之外存储额外信息（角色、联系方式等），可以创建 `user_profiles` 扩展表：

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'librarian')),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

> `user_profiles` 表完全可选，仅在需要扩展字段时创建。后续的 RLS 策略示例同样适用于该表。

> 📚 **更多扩展表**：如需借阅记录、评论、预约等功能，请参考 [DATABASE.md](./DATABASE.md) 和 [SUPABASE_TABLES_PROPOSAL.md](./SUPABASE_TABLES_PROPOSAL.md)。

---

## 4. 配置 Row Level Security (RLS)

Supabase 默认启用 RLS（行级安全）。在开发阶段可以临时禁用 RLS 以便调试，但生产环境应启用并配置策略。

### 4.1 开发环境（快速开发）

如果您只是测试应用，可以临时禁用 RLS：

```sql
ALTER TABLE books DISABLE ROW LEVEL SECURITY;
```

> ⚠️ **不推荐生产环境使用**。这将允许任何人访问数据库。

### 4.2 生产环境（推荐策略）

启用 RLS 并配置认证用户访问策略：

```sql
-- 启用 RLS
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

### 4.3 （可选）user_profiles 表的 RLS 策略

如果您创建了 `user_profiles` 扩展表，也需要配置 RLS：

```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 用户可以读取自己的信息
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 用户可以更新自己的信息
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);
```

> 根据实际业务需求调整策略（例如仅管理员可以修改图书）。

---

## 5. 获取 API Key 和 URL

1. 在 Supabase 控制台，点击上方的 **Connect**。

  ![](1.png)

2. 记录以下信息：

  ![](2.png)

3. 将这些信息填入项目根目录的 `.env` 文件中：

```env
VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

---

## 6. 本地测试

在部署之前，先在本地验证配置是否正确：

```bash
npm install
npm run dev
```

访问 `http://localhost:5173`，完成以下测试：

1. ✅ **用户注册**：使用注册页面创建新账号
2. ✅ **用户登录**：使用刚注册的账号登录
3. ✅ **添加图书**：登录后添加一本测试图书
4. ✅ **查看图书**：确认图书列表显示正常
5. ✅ **编辑/删除**：测试编辑和删除功能

如遇到问题，请检查：
- `.env` 文件中的环境变量是否正确
- Supabase 控制台中的 Email 认证是否已启用
- 数据库表和 RLS 策略是否已正确创建

---

## 7. 前端部署

以下是常见的部署平台：

### 7.1 Vercel（推荐）

1. 将代码推送到 GitHub/GitLab/Bitbucket。
2. 登录 [Vercel](https://vercel.com/)，导入项目仓库。
3. 部署设置：
   - **Framework preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. 在 **Environment Variables** 中添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. 点击 **Deploy**，等待部署完成。

### 7.2 Netlify

1. 登录 [Netlify](https://www.netlify.com/)，关联代码仓库。
2. 部署设置：
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. 在 **Site settings** → **Build & deploy** → **Environment** 中添加环境变量。
4. 触发部署。

### 7.3 其他平台

- **Render**: 使用静态站点托管，配置同 Netlify。
- **GitHub Pages**: 使用 `npm run build` 生成静态文件并上传到 `gh-pages` 分支。

---

## 8. 完整部署流程总结

完整的生产环境部署检查清单：

- [x] 步骤 1：创建 Supabase 项目
- [x] 步骤 2：启用 Email 认证（Authentication → Providers → Email）
- [x] 步骤 3：执行数据库 SQL 脚本（创建 books 表）
- [x] 步骤 4：配置 RLS 策略（建议启用认证用户策略）
- [x] 步骤 5：获取 Supabase URL 和 ANON_KEY
- [x] 步骤 6：本地测试（注册、登录、CRUD 操作）
- [x] 步骤 7：部署前端到 Vercel/Netlify 并配置环境变量
- [x] 步骤 8：访问生产环境 URL，验证所有功能正常

---

## 9. 运维建议

- 定期备份 Supabase 数据库（Supabase 自动备份 + 手动导出）
- 监控 Supabase API 使用情况，避免超出免费配额
- 定期审查 RLS 策略和 API Key
- 开启 Supabase 日志，追踪数据库操作

---

## 10. 常见问题与故障排查

### 10.1 用户认证相关

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 无法注册用户 | Email 认证未启用 | 在 Supabase Dashboard 的 Authentication → Providers 中启用 Email |
| 注册后无法登录 | 邮件确认设置问题 | 开发环境可在 Authentication → Settings 中禁用邮件确认 |
| 用户表不存在 | 误认为需要手动创建 | Supabase Auth 自动管理 `auth.users` 表，无需手动创建 |

### 10.2 数据访问相关

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 前端无法获取数据 | 环境变量缺失 / Supabase URL 错误 | 检查 `.env` 配置并重新部署 |
| 返回 401/403 错误 | RLS 策略限制 | 检查 RLS 策略，确保已认证用户有访问权限 |
| 登录后仍无法查看数据 | RLS 未正确配置 | 运行步骤 4.2 中的 RLS 策略 SQL |
| 显示空数据 | 数据库为空 | 在 Supabase 控制台或应用中添加测试数据 |

### 10.3 部署相关

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 无法访问部署站点 | 部署失败 | 查看平台日志，确认构建命令和目录是否正确 |
| 生产环境登录失败 | 环境变量未配置 | 在部署平台中添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` |
| 本地正常生产异常 | 环境变量不一致 | 确保生产和本地使用相同的 Supabase 项目配置 |

---

## 11. 更多文档资源

- 📄 [数据库设计文档](./DATABASE.md) - 详细的数据库结构说明
- 📄 [完整表创建方案](./SUPABASE_TABLES_PROPOSAL.md) - 包含借阅、评论等扩展表的完整 SQL
- 📄 [项目说明](./README.md) - 项目功能和开发指南
- 🌐 [Supabase 官方文档](https://supabase.com/docs)
- 🌐 [Vercel 部署文档](https://vercel.com/docs)
- 🌐 [Netlify 部署文档](https://docs.netlify.com/)
