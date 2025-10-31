# Supabase Storage 配置指南

本指南将帮助你设置 Supabase Storage Bucket 来存储图书封面图片。

## 功能说明

系统现已支持直接上传图片功能：

- ✅ 直接通过表单上传图片文件
- ✅ 自动上传到 Supabase Storage Bucket
- ✅ 支持图片预览
- ✅ 更新图书时自动删除旧图片
- ✅ 删除图书时自动删除关联图片
- ✅ 文件类型和大小验证

## 配置步骤

### 1. 创建 Storage Bucket

1. 登录你的 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 在左侧菜单中点击 **Storage**
4. 点击 **New bucket** 按钮
5. 填写以下信息：
   - **Name**: `book-covers`
   - **Public bucket**: 勾选（使图片可以公开访问）
6. 点击 **Create bucket**

### 2. 设置 Storage 策略

有两种方式设置存储策略：

#### 方式 1: 使用 SQL Editor（推荐）

1. 在 Supabase Dashboard 中，点击左侧菜单的 **SQL Editor**
2. 点击 **New query**
3. 复制 `STORAGE_SETUP.sql` 文件中的全部内容并粘贴
4. 点击 **Run** 执行脚本

#### 方式 2: 手动创建策略

1. 在 Supabase Dashboard 中，进入 **Storage** → 点击 `book-covers` bucket
2. 点击 **Policies** 标签
3. 手动创建以下四个策略：

**策略 1: 允许认证用户上传图片**
- Operation: `INSERT`
- Policy name: `Allow authenticated users to upload book covers`
- Target roles: `authenticated`
- Policy definition: `bucket_id = 'book-covers'`

**策略 2: 允许认证用户更新图片**
- Operation: `UPDATE`
- Policy name: `Allow authenticated users to update book covers`
- Target roles: `authenticated`
- USING expression: `bucket_id = 'book-covers'`

**策略 3: 允许认证用户删除图片**
- Operation: `DELETE`
- Policy name: `Allow authenticated users to delete book covers`
- Target roles: `authenticated`
- USING expression: `bucket_id = 'book-covers'`

**策略 4: 允许公开读取图片**
- Operation: `SELECT`
- Policy name: `Allow public to read book covers`
- Target roles: `public`
- USING expression: `bucket_id = 'book-covers'`

### 3. 验证配置

1. 启动应用：`npm run dev`
2. 登录系统
3. 点击"添加图书"
4. 尝试上传一张封面图片
5. 检查是否能够正常预览和保存

## 技术细节

### 文件命名规则

上传的文件会被重命名为：`{timestamp}-{random}.{extension}`

例如：`1698765432000-abc123.jpg`

文件存储在 bucket 的 `covers/` 目录下。

### 支持的图片格式

- JPEG/JPG
- PNG
- GIF
- WebP

### 文件大小限制

最大 5MB

可在 `src/lib/storageHelper.ts` 中修改 `maxSize` 变量来调整限制。

### 存储路径

```
book-covers (bucket)
└── covers/
    ├── 1698765432000-abc123.jpg
    ├── 1698765432001-def456.png
    └── ...
```

### 图片 URL 格式

```
https://{project-ref}.supabase.co/storage/v1/object/public/book-covers/covers/{filename}
```

## 故障排除

### 问题 1: 上传失败

**可能原因**：
- Storage bucket 未创建
- 存储策略未正确设置
- 文件大小超过限制
- 文件格式不支持

**解决方案**：
1. 检查 Supabase Dashboard 中是否存在 `book-covers` bucket
2. 验证存储策略是否正确配置
3. 检查浏览器控制台的错误信息

### 问题 2: 图片无法显示

**可能原因**：
- Bucket 未设置为 public
- 缺少 SELECT 策略

**解决方案**：
1. 确保 bucket 的 Public 选项已勾选
2. 检查是否有 public SELECT 策略

### 问题 3: 删除图书时图片未删除

**原因**：这是预期行为，系统会尝试删除图片，但即使删除失败也不会影响图书的删除。

如需调试，可以查看浏览器控制台的日志。

## 相关文件

- `src/lib/storageHelper.ts` - 图片上传/删除工具函数
- `src/components/BookForm.tsx` - 图书表单（包含图片上传）
- `src/hooks/useBooks.ts` - 图书 CRUD 操作（包含图片处理）
- `STORAGE_SETUP.sql` - Storage 策略 SQL 脚本

## 安全说明

- 只有认证用户才能上传、更新和删除图片
- 所有人都可以查看图片（因为 bucket 是 public）
- 建议在生产环境中添加文件大小和频率限制
- 可以考虑添加图片内容验证（防止上传恶意文件）

## 成本说明

Supabase 免费套餐包含：
- 1GB 存储空间
- 2GB 带宽/月

如果超出限制，需要升级到付费计划。详见 [Supabase Pricing](https://supabase.com/pricing)。

## 参考资料

- [Supabase Storage 文档](https://supabase.com/docs/guides/storage)
- [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
