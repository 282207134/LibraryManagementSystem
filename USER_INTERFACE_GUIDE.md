# 用户界面开发指南

## 开发完成状态

✅ **已完成的功能**：

### 1. 数据库迁移
- ✅ 创建 `USER_TABLES_MIGRATION.sql` 文件
- ✅ users 扩展表（包含 role 字段）
- ✅ borrowing_records 借阅记录表
- ✅ book_favorites 收藏表
- ✅ reviews 评论表（可选）
- ✅ 数据库函数：`borrow_book()` 和 `return_book()`
- ✅ Row Level Security (RLS) 策略

### 2. 类型定义
- ✅ `src/types/user.ts` - 用户类型
- ✅ `src/types/borrowing.ts` - 借阅记录类型
- ✅ `src/types/favorite.ts` - 收藏类型

### 3. 认证系统增强
- ✅ 扩展 AuthContext 支持用户角色 (role)
- ✅ 自动创建用户 profile
- ✅ 角色判断（admin/user）
- ✅ 用户注册时自动创建扩展信息

### 4. 自定义 Hooks
- ✅ `useBorrowings.ts` - 借阅功能
- ✅ `useFavorites.ts` - 收藏功能

### 5. 用户界面组件
- ✅ UserHeader - 用户导航栏
- ✅ UserLayout - 用户界面布局
- ✅ UserBookCard - 图书卡片（带借阅和收藏按钮）
- ✅ UserBookList - 图书列表

### 6. 页面
- ✅ UserHome - 用户首页（图书浏览）
- ✅ UserMyBorrowings - 我的借阅记录
- ✅ UserFavorites - 我的收藏

### 7. 路由系统
- ✅ React Router 集成
- ✅ 用户界面路由 (`/user/*`)
- ✅ 管理员界面保留 (`/admin`)
- ✅ 认证保护

---

## 部署步骤

### 第一步：运行数据库迁移

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 打开 `USER_TABLES_MIGRATION.sql` 文件
4. 复制全部内容并在 SQL Editor 中执行

**重要**：确保 `books` 表已经存在，否则会报错。

### 第二步：创建第一个管理员账户

执行迁移后，系统中所有通过注册界面注册的用户默认都是 `role = 'user'`。

要创建管理员账户：

**方法一：在 Dashboard 中操作**
1. 让用户先通过前端注册
2. 在 Supabase → Database → Table Editor → `users` 表
3. 找到该用户，将 `role` 字段从 `user` 改为 `admin`

**方法二：使用 SQL**
```sql
-- 将指定用户设置为管理员
UPDATE users
SET role = 'admin'
WHERE email = 'admin@example.com';  -- 替换为实际的管理员邮箱
```

### 第三步：启动开发服务器

```bash
npm run dev
```

---

## 使用说明

### 用户角色

#### 普通用户 (`role = 'user'`)
- ✅ 可以浏览图书
- ✅ 可以借阅图书（最多 5 本）
- ✅ 可以收藏图书
- ✅ 可以查看自己的借阅记录
- ❌ 不能访问管理后台
- ❌ 不能管理图书

#### 管理员 (`role = 'admin'`)
- ✅ 拥有所有普通用户的权限
- ✅ 可以访问管理后台 (`/admin`)
- ✅ 可以管理图书（增删改查）
- ✅ 可以查看所有用户的借阅记录
- ✅ 在用户界面导航栏会显示"管理后台"按钮

### 路由结构

```
用户界面路由：
- /user/home           # 图书浏览首页
- /user/books          # 图书浏览（同首页）
- /user/my-borrowings  # 我的借阅记录
- /user/my-favorites   # 我的收藏
- /user/profile        # 个人中心（待开发）

管理员界面路由：
- /admin               # 管理后台（原有界面）
```

### 核心功能

#### 1. 借阅图书
- 点击图书卡片上的"立即借阅"按钮
- 系统自动检查：
  - 用户是否已达借阅上限（5本）
  - 图书是否有库存
  - 用户是否已借阅过此书
- 借阅成功后：
  - 借阅期限为 30 天
  - `books.available_quantity` 自动减 1
  - 创建借阅记录

#### 2. 归还图书
- 在"我的借阅"页面点击"归还"按钮
- 系统自动：
  - 更新借阅记录状态为 `returned`
  - `books.available_quantity` 自动加 1

#### 3. 收藏图书
- 点击图书卡片上的星标按钮（⭐/☆）
- 收藏的图书会出现在"我的收藏"页面

---

## 待开发功能

### 第二阶段（增强功能）
- ⬜ 图书详情页 (`/user/books/:id`)
- ⬜ 个人中心页面（编辑个人信息）
- ⬜ 借阅统计展示
- ⬜ 搜索结果筛选（按分类、可借状态等）

### 第三阶段（扩展功能）
- ⬜ 评论系统
- ⬜ 图书评分
- ⬜ 逾期自动检测（定时任务或Edge Functions）
- ⬜ 通知系统（收藏的书上架提醒、到期提醒）

---

## 技术栈

- **前端**: React 19 + TypeScript
- **路由**: React Router 6
- **样式**: Tailwind CSS 4
- **后端**: Supabase (PostgreSQL + Auth + Storage)
- **构建工具**: Vite 7

---

## 项目结构

```
src/
├── components/
│   ├── admin/                  # 管理员组件（未使用）
│   ├── user/                   # 用户界面组件
│   │   ├── UserHeader.tsx      # 用户导航栏
│   │   ├── UserLayout.tsx      # 用户界面布局
│   │   ├── UserBookCard.tsx    # 图书卡片
│   │   └── UserBookList.tsx    # 图书列表
│   ├── BookList.tsx            # 管理员图书列表
│   ├── BookForm.tsx            # 图书表单
│   ├── SearchBar.tsx           # 搜索栏
│   ├── Header.tsx              # 管理员头部
│   ├── Login.tsx               # 登录组件
│   └── Register.tsx            # 注册组件
├── contexts/
│   ├── AuthContext.tsx         # 认证上下文（已扩展支持角色）
│   └── AuthContextBase.ts      # 认证接口定义
├── hooks/
│   ├── useAuth.ts              # 认证 Hook
│   ├── useBooks.ts             # 图书操作 Hook
│   ├── useBorrowings.ts        # 借阅操作 Hook（新增）
│   └── useFavorites.ts         # 收藏操作 Hook（新增）
├── pages/
│   ├── UserHome.tsx            # 用户首页
│   ├── UserMyBorrowings.tsx    # 我的借阅
│   └── UserFavorites.tsx       # 我的收藏
├── types/
│   ├── book.ts                 # 图书类型
│   ├── user.ts                 # 用户类型（新增）
│   ├── borrowing.ts            # 借阅记录类型（新增）
│   └── favorite.ts             # 收藏类型（新增）
├── lib/
│   ├── supabaseClient.ts       # Supabase 客户端
│   └── storageHelper.ts        # 存储辅助函数
├── App.tsx                     # 主应用（路由配置）
├── AdminApp.tsx                # 管理员界面（原 App.tsx）
└── main.tsx                    # 应用入口
```

---

## 常见问题

### 1. 用户注册后没有在 users 表中创建记录？
- 检查 `AuthContext.tsx` 中的 `signUp` 函数
- 确保数据库 RLS 策略允许插入
- 查看浏览器控制台是否有错误

### 2. 借阅功能报错？
- 确保已运行 `USER_TABLES_MIGRATION.sql`
- 确保数据库函数 `borrow_book` 和 `return_book` 已创建
- 检查 `borrowing_records` 表的 RLS 策略

### 3. 管理员无法访问管理后台？
- 确保在 `users` 表中将该用户的 `role` 设为 `admin`
- 刷新页面让 AuthContext 重新加载用户信息
- 检查导航栏是否显示"管理后台"按钮

### 4. 收藏功能不work？
- 确保 `book_favorites` 表已创建
- 检查 RLS 策略是否正确
- 查看浏览器控制台的错误信息

---

## 下一步

1. **测试基本功能**：
   - 注册一个普通用户，测试借阅和收藏
   - 将一个用户设为管理员，测试管理功能
   
2. **完善图书详情页**：
   - 创建 `UserBookDetail.tsx` 组件
   - 显示图书完整信息
   - 集成借阅和收藏按钮

3. **开发个人中心**：
   - 编辑个人信息
   - 显示借阅统计
   - 修改密码

4. **优化用户体验**：
   - 添加加载动画
   - 优化移动端响应式
   - 添加错误边界

---

## 联系与支持

如有问题，请查阅：
- [USER_INTERFACE_DESIGN.md](./USER_INTERFACE_DESIGN.md) - 完整设计文档
- [DATABASE.md](./DATABASE.md) - 数据库设计
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署指南

**构建成功！** 🎉

现在可以运行 `npm run dev` 启动开发服务器进行测试。
