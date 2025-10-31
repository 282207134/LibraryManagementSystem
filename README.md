# 图书管理系统 (Books Management System)

一个基于 React + TypeScript + Supabase 的现代化图书管理系统，实现图书的增删改查（CRUD）功能。

## 技术栈

- **前端框架**: React 18+ with TypeScript
- **构建工具**: Vite
- **UI 框架**: Tailwind CSS
- **后端服务**: Supabase (PostgreSQL + Real-time API)
- **状态管理**: React Hooks (useState, useEffect, useCallback)
- **数据库**: PostgreSQL (通过 Supabase)

## 功能特性

- ✅ 用户认证（登录/注册）
- ✅ 用户权限管理
- ✅ 图书列表展示（表格视图 + 卡片视图）
- ✅ 添加新图书
- ✅ 编辑图书信息
- ✅ 删除图书（带确认）
- ✅ 图书封面图片支持
- ✅ 搜索功能（按书名或作者）
- ✅ 分页加载
- ✅ 响应式设计（移动端友好）
- ✅ 表单验证（ISBN格式、必填字段等）
- ✅ 实时错误提示和成功通知

## 项目结构

```
src/
├── components/           # React 组件
│   ├── BookList.tsx     # 图书列表组件
│   ├── BookForm.tsx     # 添加/编辑表单组件
│   ├── BookCard.tsx     # 图书卡片组件
│   ├── SearchBar.tsx    # 搜索栏组件
│   ├── Header.tsx       # 头部导航组件
│   ├── Login.tsx        # 登录组件
│   └── Register.tsx     # 注册组件
├── contexts/            # React Context
│   └── AuthContext.tsx  # 认证上下文
├── hooks/               # 自定义 Hooks
│   └── useBooks.ts      # 图书 CRUD 操作 Hook
├── lib/                 # 工具库
│   └── supabaseClient.ts # Supabase 客户端配置
├── types/               # TypeScript 类型定义
│   └── book.ts          # 图书类型定义
├── App.tsx              # 主应用组件
├── main.tsx             # 应用入口
└── index.css            # 全局样式
```

## 本地开发环境设置

### 前置要求

- Node.js >= 16.x
- npm 或 yarn
- Supabase 账号（免费）

### 安装步骤

1. **克隆仓库**

```bash
git clone <repository-url>
cd <project-directory>
```

2. **安装依赖**

```bash
npm install
```

3. **配置环境变量**

复制 `.env.example` 文件并重命名为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 Supabase 项目信息：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

4. **设置 Supabase 数据库**

**重要**：请按照 [DEPLOYMENT.md](./DEPLOYMENT.md) 部署指南完成以下操作：
   - 创建 Supabase 项目
   - 启用用户认证（Supabase 自动处理用户表，无需手动创建）
   - 运行数据库 SQL 脚本创建 books 表
   - 配置 RLS 策略

> 📖 如需详细的数据库设计说明，可参考 [DATABASE.md](./DATABASE.md)。

5. **启动开发服务器**

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动。

## 可用脚本

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

## 环境变量配置

项目需要以下环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |

> **注意**: 所有 Vite 环境变量必须以 `VITE_` 前缀开头才能在客户端代码中访问。

### 用户认证配置

1. 打开 Supabase 项目控制台，进入 **Authentication → Providers**。
2. 启用 **Email** 登录方式，并根据需要配置邮件模板。
3. 在 **Authentication → Policies** 中确保匿名访问被禁用，仅允许已认证用户访问 `books` 表。

#### 用户表说明

Supabase Auth 会自动维护 `auth.users` 表用于账号注册和登录，无需手动创建额外的用户表。只需启用 Email 登录（或其他登录方式），即可以 Supabase Auth 提供的用户体系完成基础认证。

如果需要扩展用户资料（例如角色、手机号等额外字段），可以创建一个与 `auth.users` 一对一关联的 `users` 扩展表。详细的建表 SQL 和推荐策略请参考 [SUPABASE_TABLES_PROPOSAL.md](./SUPABASE_TABLES_PROPOSAL.md)。

### 图书封面图片上传

本系统支持直接上传图片到 Supabase Storage：

- 创建名为 `book-covers` 的公开存储桶（Storage Bucket）
- 运行 `STORAGE_SETUP.sql` 脚本设置存储策略
- 支持的图片格式：JPEG、PNG、GIF、WebP
- 图片大小限制：最大 5MB
- 系统会自动管理图片的上传、更新和删除

**设置步骤**：

1. 在 Supabase Dashboard 中进入 Storage
2. 创建新的 bucket，命名为 `book-covers`，设置为 public
3. 在 SQL Editor 中运行 `STORAGE_SETUP.sql` 文件中的脚本来设置访问策略

## 数据库设计

### books 表结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键，自动生成 |
| title | VARCHAR(255) | 书名（必填） |
| author | VARCHAR(255) | 作者（必填） |
| isbn | VARCHAR(13) | ISBN 编号（唯一） |
| publisher | VARCHAR(255) | 出版社 |
| publication_year | INTEGER | 出版年份 |
| category | VARCHAR(100) | 图书分类 |
| description | TEXT | 图书简介 |
| quantity | INTEGER | 库存数量 |
| available_quantity | INTEGER | 可借数量 |
| cover_image_url | TEXT | 图书封面 URL |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

详细的数据库设计和 SQL 脚本请参考 [DATABASE.md](./DATABASE.md)。

## 部署

详细的部署指南请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)，包括：

- Supabase 项目设置
- 数据库表创建
- RLS (Row Level Security) 配置
- 前端部署到 Vercel/Netlify

## 表单验证规则

- **书名**: 必填
- **作者**: 必填
- **ISBN**: 可选，但如果填写必须是10位或13位数字
- **出版年份**: 可选，范围 1000-9999
- **库存数量**: 必填，最小值 0
- **可借数量**: 必填，不能大于库存数量

## 开发注意事项

1. **TypeScript 类型安全**: 项目使用 TypeScript，确保类型定义正确
2. **错误处理**: 所有数据库操作都包含错误处理逻辑
3. **加载状态**: 异步操作显示加载状态，提升用户体验
4. **响应式设计**: 使用 Tailwind CSS 实现移动端适配
5. **代码规范**: 遵循 ESLint 配置的代码规范

## 常见问题

### 1. 无法连接到 Supabase

- 检查 `.env` 文件中的 URL 和 API Key 是否正确
- 确认 Supabase 项目是否已激活
- 检查网络连接

### 2. 数据库错误

- 确认数据库表已正确创建
- 检查 RLS (Row Level Security) 策略配置
- 查看 Supabase Dashboard 的日志

### 3. 搜索功能不工作

- 确认数据库索引已创建
- 检查搜索关键词是否正确

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过 Issue 联系我们。

---

## 📚 相关文档

### 部署与配置

- **[部署指南](./DEPLOYMENT.md)** ⭐ **推荐首先阅读** - 包含完整的部署步骤、用户认证配置、数据库表创建 SQL 和常见问题排查

### 数据库设计

- **[数据库设计文档](./DATABASE.md)** - 详细的数据库结构和字段说明
- **[完整表创建方案](./SUPABASE_TABLES_PROPOSAL.md)** - 包含借阅记录、评论等扩展功能的完整 SQL（可选）

### 外部资源

- [Supabase 官方文档](https://supabase.com/docs)
- [React 官方文档](https://react.dev/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)

> 💡 **新手建议**：如果您是第一次部署，请从 [DEPLOYMENT.md](./DEPLOYMENT.md) 开始，它包含了所有必需的步骤和 SQL 脚本。其他文档主要用于深入了解数据库设计和扩展功能。
