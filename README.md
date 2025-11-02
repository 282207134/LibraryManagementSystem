# 📚 图书管理系统

基于 **React + TypeScript + Supabase** 构建的现代化图书管理系统，实现图书的增删改查、用户认证以及封面图片管理等核心能力。

> 想最快速地把项目跑起来？请直接阅读 👉 [DEPLOY.md](./DEPLOY.md)

---

## ✨ 功能亮点

- 用户注册、登录与会话管理（Supabase Auth）
- 图书的新增、编辑、删除与列表展示
- 搜索与分页，支持移动端响应式布局
- 图书封面上传，可选的 Supabase Storage 集成
- TypeScript 全面类型约束与实时错误提示

---

## 🛠 技术栈

| 模块 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| UI 框架 | Tailwind CSS |
| 数据与认证 | Supabase (PostgreSQL + Auth + Storage) |

项目结构（节选）：

```
src/
├── components/        # 组件（列表、表单、搜索等）
├── contexts/          # 认证上下文
├── hooks/             # 自定义 hooks（如 useBooks）
├── lib/               # Supabase 客户端封装
├── types/             # TypeScript 类型定义
└── main.tsx / App.tsx # 入口与根组件
```

---

## ⚡ 快速开始

```bash
git clone <repository-url>
cd <project-directory>
npm install
cp .env.example .env
```

在 Supabase 创建项目、启用 Email 登录，并将获取到的 URL 与 anon key 写入 `.env`：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

运行开发服务器：

```bash
npm run dev
```

浏览器访问 `http://localhost:5173`，注册账号并验证 CRUD 功能即可。

> 需要数据库脚本、RLS 策略、部署和故障排查等完整步骤，请查看 [DEPLOY.md](./DEPLOY.md)。

---

## 🔑 环境变量

| 变量名 | 说明 |
|--------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 公共 anon key |

所有 Vite 环境变量必须以 `VITE_` 前缀开头。

---

## 🧪 可用脚本

```bash
npm run dev      # 开发模式
npm run build    # 构建生产版本
npm run preview  # 预览生产构建
npm run lint     # ESLint 检查
```

---

## 🚀 部署

推荐部署流程（Vercel）：

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入仓库
3. Build Command：`npm run build`
4. Output Directory：`dist`
5. 在平台环境变量中配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

更详细的说明请阅读 [DEPLOY.md](./DEPLOY.md)。

---

## 📄 文档索引

| 文档 | 内容 |
|------|------|
| [DEPLOY.md](./DEPLOY.md) | 一站式部署指南（含 SQL 脚本、RLS 策略、图片上传配置与常见问题） |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | 常见问题排查与解决方案 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request：

1. Fork 本仓库
2. 创建分支 `git checkout -b feature/xxx`
3. 提交更改 `git commit -m "feat: add xxx"`
4. 推送分支并发起 PR

---

## 📜 许可证

MIT License
