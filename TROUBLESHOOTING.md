# 🔧 故障排除指南

遇到问题？本指南帮你快速解决常见错误。

---

## 🔐 认证问题

### 无法注册或登录

**症状**：点击注册/登录后无响应，或提示认证错误。

**解决方案**：

1. **检查 Email 登录是否启用**
   - 在 Supabase Dashboard → **Authentication** → **Providers**
   - 确保 **Email** 已启用

2. **检查环境变量**
   - 打开 `.env` 文件，确认 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 正确
   - 重启开发服务器：`npm run dev`

3. **禁用邮件确认（开发环境）**
   - 在 Supabase Dashboard → **Authentication** → **Settings**
   - 取消勾选 "Enable email confirmations"

---

## 📊 数据访问问题

### 无法加载图书列表

**症状**：页面一直显示"加载中..."，或返回空数据。

**解决方案**：

1. **检查数据库表是否已创建**
   - 在 Supabase Dashboard → **SQL Editor** 运行：
     ```sql
     SELECT * FROM books LIMIT 1;
     ```
   - 如果报错表不存在，请运行 [DEPLOY.md](./DEPLOY.md) 中的完整 SQL 脚本

2. **检查 RLS 策略**
   - 在 SQL Editor 运行：
     ```sql
     SELECT * FROM pg_policies WHERE tablename = 'books';
     ```
   - 如果策略缺失，重新运行 [DEPLOY.md](./DEPLOY.md) 中的 RLS 策略 SQL

3. **检查是否已登录**
   - RLS 策略要求用户必须登录才能访问数据
   - 确保已完成注册和登录流程

### 显示 401 或 403 错误

**原因**：RLS 策略限制了数据访问。

**解决方案**：
- 确保用户已登录
- 在 Supabase Dashboard 查看日志（**Logs** 菜单）
- 检查 RLS 策略是否正确配置

---

## 📸 图片上传问题

### 图片上传失败或无法显示

**症状**：
- 上传后显示"无封面"
- 浏览器控制台显示 "Bucket not found"
- 图片 404 错误

**解决方案**：

#### 步骤 1：创建存储桶

1. 在 Supabase Dashboard → **Storage**
2. 点击 **New bucket**
3. 名称：`book-covers`（必须是这个名称）
4. ✅ 勾选 **Public bucket**
5. 点击 **Create**

#### 步骤 2：配置存储策略

在 SQL Editor 中运行：

```sql
-- 允许已认证用户上传
CREATE POLICY "Allow authenticated upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'book-covers');

-- 允许已认证用户更新
CREATE POLICY "Allow authenticated update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'book-covers');

-- 允许已认证用户删除
CREATE POLICY "Allow authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'book-covers');

-- 允许公开读取
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'book-covers');
```

#### 步骤 3：验证

重启应用并尝试上传图片，检查是否正常显示。

---

## 🚀 部署问题

### 本地正常，部署后异常

**症状**：本地开发环境一切正常，部署到 Vercel/Netlify 后功能不工作。

**解决方案**：

1. **检查环境变量**
   - 在部署平台（Vercel/Netlify）的设置中添加：
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - 环境变量必须以 `VITE_` 开头

2. **重新部署**
   - 添加环境变量后，触发重新部署

3. **检查构建日志**
   - 查看部署平台的构建日志，确认是否有错误

### 部署失败

**常见原因**：
- 构建命令不正确
- 输出目录配置错误

**正确配置**（Vercel/Netlify）：
- Build Command: `npm run build`
- Output Directory: `dist`
- Framework: Vite

---

## 💻 开发环境问题

### npm install 失败

**解决方案**：

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

检查 Node.js 版本：

```bash
node --version  # 应该 >= 16.x
```

### 端口占用

**症状**：`npm run dev` 提示端口 5173 被占用。

**解决方案**：

使用其他端口：

```bash
npm run dev -- --port 3000
```

---

## 🔍 调试技巧

### 查看详细错误

1. **浏览器控制台**
   - 按 F12 打开开发者工具
   - 查看 Console 标签的错误信息

2. **Supabase 日志**
   - 在 Supabase Dashboard → **Logs**
   - 查看 API、Auth 和数据库日志

3. **网络请求**
   - 在浏览器开发者工具的 Network 标签
   - 查看失败的请求及其响应

---

## ❓ 还是无法解决？

1. 检查 [DEPLOY.md](./DEPLOY.md) 确保所有步骤都已正确完成
2. 查看 Supabase Dashboard 的日志
3. 提交 Issue 时请包含：
   - 完整的错误信息截图
   - 浏览器控制台的错误日志
   - 你的操作步骤
   - Node.js 版本（`node --version`）
