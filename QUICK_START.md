# 快速入门 - 用户界面

## 🚀 快速启动

### 1. 安装依赖（如已安装可跳过）
```bash
npm install
```

### 2. 配置环境变量
确保 `.env` 文件已配置：
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. 运行数据库迁移

**打开 Supabase Dashboard** → SQL Editor，执行 `USER_TABLES_MIGRATION.sql` 中的所有SQL语句。

这将创建：
- ✅ `users` 表（用户扩展信息）
- ✅ `borrowing_records` 表（借阅记录）
- ✅ `book_favorites` 表（收藏）
- ✅ `reviews` 表（评论，可选）
- ✅ 数据库函数和触发器
- ✅ RLS 安全策略

### 4. 启动开发服务器
```bash
npm run dev
```

访问 `http://localhost:5173` 即可看到新的用户界面！

---

## 👤 创建管理员账户

**步骤：**

1. 先通过前端注册一个普通账户
2. 在 Supabase Dashboard → Database → `users` 表
3. 找到刚注册的用户，将 `role` 从 `user` 改为 `admin`
4. 刷新前端页面

**或使用SQL：**
```sql
UPDATE users
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

---

## 🎯 功能测试

### 作为普通用户：
1. ✅ 注册/登录
2. ✅ 浏览图书（首页）
3. ✅ 借阅图书（点击"立即借阅"）
4. ✅ 查看"我的借阅"
5. ✅ 归还图书
6. ✅ 收藏图书（点击星标）
7. ✅ 查看"我的收藏"

### 作为管理员：
1. ✅ 所有普通用户功能
2. ✅ 点击导航栏"管理后台"按钮
3. ✅ 管理图书（增删改查）
4. ✅ 可以在用户界面和管理后台之间切换

---

## 📁 重要文件

| 文件 | 说明 |
|------|------|
| `USER_TABLES_MIGRATION.sql` | 数据库迁移脚本（**必须执行**） |
| `USER_INTERFACE_DESIGN.md` | 完整的设计文档 |
| `USER_INTERFACE_GUIDE.md` | 开发指南和使用说明 |
| `src/App.tsx` | 主应用入口（路由配置） |
| `src/AdminApp.tsx` | 管理员界面（原App.tsx） |

---

## 🌐 路由说明

| 路由 | 说明 | 权限 |
|------|------|------|
| `/user/home` | 图书浏览首页 | 所有用户 |
| `/user/my-borrowings` | 我的借阅记录 | 需登录 |
| `/user/my-favorites` | 我的收藏 | 需登录 |
| `/user/profile` | 个人中心（开发中） | 需登录 |
| `/admin` | 管理后台 | 仅管理员 |

---

## ⚙️ 技术栈

- React 19 + TypeScript
- React Router 7
- Tailwind CSS 4
- Supabase (PostgreSQL + Auth)
- Vite 7

---

## 🐛 常见问题

### Q: 借阅功能报错 "function borrow_book does not exist"
A: 请确保已执行 `USER_TABLES_MIGRATION.sql` 中的所有SQL语句。

### Q: 收藏功能不工作
A: 检查 `book_favorites` 表和RLS策略是否已创建。

### Q: 管理员看不到"管理后台"按钮
A: 确保在 `users` 表中将 `role` 设为 `admin`，然后刷新页面。

### Q: 用户注册后 users 表中没有记录
A: 检查浏览器控制台错误，确认 RLS 策略允许插入。

---

## 📝 待办事项

- [ ] 图书详情页
- [ ] 个人中心页面（编辑个人信息）
- [ ] 评论系统
- [ ] 通知系统（逾期提醒、收藏通知）
- [ ] 搜索筛选功能增强

---

## 📞 获取帮助

- 详细设计：`USER_INTERFACE_DESIGN.md`
- 开发指南：`USER_INTERFACE_GUIDE.md`
- 数据库设计：`DATABASE.md`
- 部署指南：`DEPLOYMENT.md`

**开发完成！** 🎉 现在可以开始使用和测试了。
