# 故障排除指南 (Troubleshooting Guide)

本文档旨在帮助您解决使用图书管理系统时可能遇到的常见问题。

## 图片上传和显示问题

### 问题：图片上传后显示"无封面"或图片加载失败

**症状：**
- 成功上传图片，但在 Supabase 中找不到
- 上传后显示"无封面"
- 图片加载失败，显示 404 错误
- 浏览器控制台显示 "Bucket not found" 错误

**原因：**
Supabase Storage 存储桶（bucket）未创建或配置不正确。

**解决方案：**

#### 步骤 1：创建存储桶

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 在左侧菜单中点击 **Storage**
4. 点击 **New bucket** 按钮
5. 填写以下信息：
   - **Name**: `book-covers` （必须使用此名称）
   - **Public bucket**: ✅ **必须勾选**（使图片可以公开访问）
6. 点击 **Create bucket**

#### 步骤 2：配置存储策略

创建存储桶后，需要设置访问策略以允许用户上传、更新、删除和查看图片。

**方法 1: 使用 SQL 脚本（推荐）**

1. 在 Supabase Dashboard 中，点击左侧菜单的 **SQL Editor**
2. 点击 **New query**
3. 复制 `STORAGE_SETUP.sql` 文件中的全部内容并粘贴
4. 点击 **Run** 执行脚本

**方法 2: 手动创建策略**

如果您已经创建了存储桶，可以手动添加策略：

1. 在 Supabase Dashboard 中，进入 **Storage** → 点击 `book-covers` bucket
2. 点击 **Policies** 标签
3. 创建以下四个策略：

**策略 1: 允许认证用户上传**
```sql
CREATE POLICY "Allow authenticated users to upload book covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'book-covers');
```

**策略 2: 允许认证用户更新**
```sql
CREATE POLICY "Allow authenticated users to update book covers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'book-covers');
```

**策略 3: 允许认证用户删除**
```sql
CREATE POLICY "Allow authenticated users to delete book covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'book-covers');
```

**策略 4: 允许公开读取**
```sql
CREATE POLICY "Allow public to read book covers"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'book-covers');
```

#### 步骤 3：验证配置

1. 启动应用：`npm run dev`
2. 登录系统
3. 点击"添加图书"
4. 尝试上传一张封面图片
5. 检查是否能够正常预览和保存

### 问题：图片上传成功，但之前上传的图片显示不出来

**症状：**
- 新上传的图片可以显示
- 数据库中有旧图片的 URL
- 但旧图片无法加载（404 错误）

**原因：**
之前上传的图片保存在尚未创建的存储桶中。这些 URL 指向不存在的文件。

**解决方案：**

1. **删除损坏的记录并重新上传：**
   - 编辑相关图书
   - 重新上传封面图片
   - 系统会自动上传到正确的存储桶

2. **或者清除旧的图片 URL：**
   ```sql
   -- 在 Supabase SQL Editor 中运行
   UPDATE books SET cover_image_url = NULL WHERE cover_image_url IS NOT NULL;
   ```

### 问题：signed URL 签名过期

**症状：**
- 图片显示一段时间后无法加载
- 控制台显示 403 或签名验证失败

**原因：**
系统使用签名 URL 来提供更好的安全性。签名 URL 有 1 小时的有效期。

**解决方案：**
这是正常行为。刷新页面后，系统会自动生成新的签名 URL。

如果您希望使用永久的公开 URL 而不是签名 URL：
1. 确保存储桶已设置为 public
2. 确保存在 public SELECT 策略（见上文步骤 2）

---

## 认证问题

### 问题：无法登录或注册

**症状：**
- 点击登录后无响应
- 注册后收不到验证邮件
- 显示"未启用邮箱登录"错误

**解决方案：**

1. 在 Supabase Dashboard 中启用 Email 认证：
   - 进入 **Authentication** → **Providers**
   - 找到 **Email** 并启用
   - 配置邮件模板（可选）

2. 检查环境变量：
   - 确认 `.env` 文件中的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 正确
   - 重启开发服务器：`npm run dev`

3. 如果是在生产环境，确认邮件配置：
   - Supabase 免费套餐有邮件发送限制
   - 可以配置自定义 SMTP 服务器

---

## 数据库问题

### 问题：无法读取或写入图书数据

**症状：**
- 页面显示"加载中..."但没有数据
- 添加图书时显示权限错误
- 控制台显示 RLS 策略错误

**解决方案：**

1. 检查 `books` 表是否已创建：
   ```sql
   SELECT * FROM books LIMIT 1;
   ```

2. 检查 RLS 策略：
   ```sql
   -- 查看现有策略
   SELECT * FROM pg_policies WHERE tablename = 'books';
   ```

3. 运行 `MIGRATION.sql` 中的脚本来创建/更新策略：
   - 在 Supabase SQL Editor 中打开新查询
   - 复制 `MIGRATION.sql` 的内容并执行

### 问题：搜索功能不工作

**症状：**
- 输入搜索关键词后无结果
- 或搜索很慢

**解决方案：**

1. 确保数据库索引已创建（参考 `DATABASE.md`）
2. 检查搜索关键词是否正确
3. 尝试使用部分关键词而不是完整书名

---

## 开发环境问题

### 问题：npm install 失败

**解决方案：**

1. 清除缓存：
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. 检查 Node.js 版本：
   ```bash
   node --version  # 应该 >= 16.x
   ```

### 问题：Vite 无法启动

**解决方案：**

1. 检查端口占用：
   ```bash
   # Linux/Mac
   lsof -i :5173
   
   # Windows
   netstat -ano | findstr :5173
   ```

2. 尝试使用不同端口：
   ```bash
   npm run dev -- --port 3000
   ```

---

## 需要更多帮助？

如果以上解决方案无法解决您的问题：

1. 检查浏览器控制台的错误信息
2. 查看 Supabase Dashboard 的日志（Logs 菜单）
3. 参考相关文档：
   - [STORAGE_SETUP.md](./STORAGE_SETUP.md) - 存储配置详细说明
   - [DATABASE.md](./DATABASE.md) - 数据库结构说明
   - [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署指南

4. 提交 Issue 时，请包含：
   - 错误的完整描述
   - 浏览器控制台的错误信息截图
   - 您的操作步骤
   - 使用的 Node.js 版本
