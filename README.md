# 图书管理系统（Library Management System）

一个基于 React + TypeScript + Supabase 的图书管理系统，包含用户端、管理员端、借阅收藏评论、以及 Edge Function AI 助手。

<img width="780" height="404" alt="image" src="https://github.com/user-attachments/assets/e7393e94-733b-4ebf-ae52-fd05937fd017" />
<img width="709" height="710" alt="image" src="https://github.com/user-attachments/assets/19c42f59-fec2-4063-8509-a50c3400f021" />

## 在线查看
<img width="212" height="218" alt="image" src="https://github.com/user-attachments/assets/bbbd99eb-4ce8-4ee9-8b1d-97056b6ee9ce" />

https://library-management-system-chi-lyart.vercel.app/
## 技术栈

- React 19 + TypeScript 5
- Vite 7 + Tailwind CSS 4
- React Router 7
- Supabase（Auth / PostgreSQL / Storage / Edge Functions）

## 已实现能力

- 认证：登录、注册、忘记密码、重置密码
- 用户端：仪表盘、图书浏览、图书详情、我的借阅、我的收藏、个人资料
- 管理端：图书管理（CRUD）、借阅记录管理
- 业务：借阅/归还 RPC、收藏、评论评分、封面上传
- 多语言：中文/English/日本語切换
- AI 助手：`ai-chat` Edge Function + 前端对话卡片 + 书目分页推荐

## 路由（当前实现）

- 未登录：默认显示登录/注册（同一路由内切换），`/reset-password` 可直接访问
- 已登录用户：
  - `/user/dashboard`
  - `/user/home`、`/user/books`
  - `/user/books/:id`
  - `/user/my-borrowings`
  - `/user/my-favorites`
  - `/user/profile`
- 管理员专属：
  - `/admin/dashboard`
  - `/admin/borrowings`

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env
```

3. 在 `.env` 中填写：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. 按照 `部署指南.md` 完成数据库/RLS/Storage 配置。

5. 启动开发：

```bash
npm run dev
```

默认访问：`http://localhost:5173`

## 常用脚本

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

### Edge Function（AI 助手）脚本

```bash
npm run supabase:functions:serve
npm run supabase:cloud:secrets
npm run supabase:functions:deploy
```

> 注意：`package.json` 中 `--project-ref` 需与你自己的 Supabase 项目一致。

## 环境变量说明

| 变量 | 位置 | 用途 |
|---|---|---|
| `VITE_SUPABASE_URL` | 根目录 `.env` | 前端连接 Supabase 项目地址 |
| `VITE_SUPABASE_ANON_KEY` | 根目录 `.env` | 前端匿名 key（可公开） |
| `CHAT_PROVIDER` | `supabase/functions/.env` | `deepseek` 或 `ollama` |
| `DEEPSEEK_API_KEY` | `supabase/functions/.env` | DeepSeek 模型密钥（仅函数端） |
| `OLLAMA_BASE_URL` | `supabase/functions/.env` | Ollama API 地址 |

## 安全要点

- 前端只允许使用 `anon` key，不可放 `service_role`。
- 模型 API key 只放在 `supabase/functions/.env` 和云端 secrets。
- 权限控制以 RLS + RPC 为准，前端路由守卫只是体验层。

## 相关文档

- [部署指南](./部署指南.md)
- [数据库文档](./DATABASE.md)
- [Supabase 表与 SQL 方案](./SUPABASE_TABLES_PROPOSAL.md)
- [项目设计书](./项目设计书.md)
- [用户界面设计](./USER_INTERFACE_DESIGN.md)
- [AI 助手说明](./AI_ASSISTANT.md)
