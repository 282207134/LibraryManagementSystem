# 用户界面设计文档

## 文档概述

本文档描述了图书管理系统的**用户界面（User Interface）**的功能需求、设计方案和实现规划。用户界面与现有的管理员界面分离，为普通用户提供浏览、租借和收藏图书的功能。

---

## 1. 项目背景

### 1.1 现有系统
当前系统是一个**管理员界面**，提供以下功能：
- ✅ 管理员登录/注册
- ✅ 图书 CRUD 操作（增删改查）
- ✅ 图书封面上传
- ✅ 搜索和分页功能

### 1.2 新增需求
需要开发一个**用户界面**，让普通用户能够：
- 📖 **浏览图书**：查看所有可用图书的详细信息
- 📚 **租借图书**：借阅图书并管理借阅记录
- ⭐ **收藏功能**：收藏感兴趣的图书或分类，便于快速访问
- 👤 **用户账户**：独立的用户注册、登录和个人中心

---

## 2. 功能设计

### 2.1 用户认证模块

#### 2.1.1 用户注册
- 使用独立的用户注册流程
- 字段包括：
  - 邮箱（必填）
  - 密码（必填）
  - 姓名（必填）
  - 电话（可选）
  - 地址（可选）
- 注册后自动分配 `user` 角色（与管理员 `admin` 角色区分）

#### 2.1.2 用户登录
- 邮箱 + 密码登录
- 记住登录状态（使用 Supabase Session）
- 登录后进入用户首页

#### 2.1.3 角色区分与权限
- **管理员（admin）**：
  - ✅ 可以访问管理员界面，管理图书（增删改查）
  - ✅ **也可以访问用户界面**，查看和使用所有用户功能
  - ✅ 可以借阅图书（与普通用户相同）
  - ✅ 可以查看所有用户的借阅记录（管理员特权）
  - 权限等级：最高
  
- **普通用户（user）**：
  - ✅ 只能访问用户界面
  - ✅ 浏览和借阅图书
  - ✅ 只能查看自己的借阅记录
  - ❌ 不能访问管理员界面
  - ❌ 不能进行图书管理操作
  - 权限等级：基础

**权限继承原则**：管理员拥有所有普通用户的权限，外加管理权限。

#### 2.1.4 权限系统实现原理

**重要说明**：Supabase Auth 本身不提供"管理员/普通用户"的角色管理功能。所有权限控制都是通过数据库中的 `role` 字段实现的。

##### 权限实现方式

1. **数据库层面**：在 `users` 扩展表中添加 `role` 字段
   ```sql
   CREATE TABLE users (
     id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     email VARCHAR(255) UNIQUE NOT NULL,
     full_name VARCHAR(255) NOT NULL,
     role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
     -- 其他字段...
   );
   ```

2. **默认角色分配**：通过用户注册界面注册的账号 **默认 role = 'user'**

3. **创建管理员账号的方法**：

   **方法一：在 Supabase Dashboard 中操作**
   
   a. 在 Supabase → Authentication → Users 中创建或找到用户
   
   b. 复制该用户的 UID（例如：`2d72f58a-4a46-4b93-8d52-e3545f164258`）
   
   c. 在 Supabase → Database → Table Editor → `users` 表中找到该用户
   
   d. 将 `role` 字段从 `user` 修改为 `admin`
   
   **方法二：使用 SQL Editor**
   ```sql
   -- 将指定用户设置为管理员
   UPDATE users
   SET role = 'admin'
   WHERE id = '2d72f58a-4a46-4b93-8d52-e3545f164258';  -- 替换为实际的用户 UID
   ```
   
   **方法三：将管理员降级为普通用户**
   ```sql
   UPDATE users
   SET role = 'user'
   WHERE id = '管理员的UID';
   ```

4. **前端权限判断**：
   ```typescript
   // 获取当前用户的角色
   const { data: userProfile } = await supabase
     .from('users')
     .select('role')
     .eq('id', user.id)
     .single();
   
   if (userProfile.role === 'admin') {
     // 显示管理员功能
   } else {
     // 显示普通用户功能
   }
   ```

5. **RLS 策略控制**：使用 Row Level Security 在数据库层面控制权限
   ```sql
   -- 只有管理员可以修改图书
   CREATE POLICY "Only admins can update books" ON books
   FOR UPDATE
   USING (
     EXISTS (
       SELECT 1 FROM users
       WHERE users.id = auth.uid() AND users.role = 'admin'
     )
   );
   ```

---

### 2.2 图书浏览与收藏模块

#### 2.2.1 图书列表页面
**功能特性**：
- 展示所有可借阅的图书
- 支持两种视图：
  - 📋 **列表视图**：紧凑的表格形式
  - 🎴 **卡片视图**：带封面的卡片布局（推荐）
- 显示图书信息：
  - 封面图片
  - 书名、作者
  - 分类、出版社
  - 可借数量/总库存
  - 评分（如已实现评论功能）

**交互功能**：
- 点击图书卡片/行 → 进入图书详情页
- 快速借阅按钮（需登录）
- ⭐ 收藏按钮（收藏/取消收藏）

#### 2.2.2 搜索与筛选
**搜索功能**：
- 按书名搜索
- 按作者搜索
- 按 ISBN 搜索

**筛选功能**：
- 按分类筛选（小说、科技、历史等）
- 按可借状态筛选（仅显示可借图书）
- 按收藏状态筛选（显示已收藏图书）
- 按出版年份排序

**排序选项**：
- 最新添加
- 书名 A-Z
- 最受欢迎（基于借阅次数或收藏次数）

#### 2.2.3 图书详情页面
**显示内容**：
- 完整的图书信息
  - 大尺寸封面图
  - 书名、作者、ISBN
  - 出版社、出版年份
  - 分类、描述
  - 库存信息（总数/可借数）
- 借阅按钮（根据可借状态动态显示）
- ⭐ 收藏按钮（显示当前收藏状态）

**用户评论区（扩展功能）**：
- 显示其他用户的评分和评论
- 登录用户可发表评论和评分

---

### 2.3 图书租借模块

#### 2.3.1 借阅功能
**借阅流程**：
1. 用户点击"借阅"按钮
2. 系统检查：
   - 用户是否已登录
   - 用户是否达到借阅上限（默认 5 本）
   - 图书是否有可借库存
3. 显示借阅确认对话框：
   - 借阅期限（默认 30 天）
   - 到期日期
   - 借阅规则提醒
4. 确认后创建借阅记录：
   - `borrowing_records` 表新增一条记录
   - `books.available_quantity` 减 1
   - 状态设为 `borrowed`

**借阅限制**：
- 每位用户最多同时借阅 5 本书
- 单本书借阅期限为 30 天
- 逾期后不能继续借阅新书

#### 2.3.2 我的借阅记录
**页面内容**：
- 当前借阅中的图书：
  - 图书信息
  - 借阅日期
  - 到期日期
  - 剩余天数（倒计时）
  - 归还按钮
- 历史借阅记录：
  - 已归还的图书
  - 借阅和归还日期
  - 借阅时长

**状态管理**：
- `borrowed`：借阅中
- `overdue`：已逾期
- `returned`：已归还
- `lost`：丢失/损坏

#### 2.3.3 归还功能
**归还流程**：
1. 用户在"我的借阅"中点击"归还"
2. 系统更新：
   - `borrowing_records.returned_at` = 当前时间
   - `borrowing_records.status` = `returned`
   - `books.available_quantity` 加 1
3. 显示归还成功提示

**逾期处理**：
- 自动将超过到期日期的记录标记为 `overdue`
- 逾期用户需完成归还后才能继续借阅

---

### 2.4 收藏功能模块

#### 2.4.1 图书收藏
**功能描述**：
- 用户可以收藏感兴趣的图书
- 收藏图书会出现在"我的收藏"页面，便于快速访问

**实现方式**：
- 创建 `book_favorites` 表：
  ```sql
  CREATE TABLE book_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    favorited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, book_id)
  );
  ```

**用户操作**：
- 在图书详情页或列表中点击"收藏"/"取消收藏"按钮
- 在"我的收藏"页面查看所有收藏的图书

#### 2.4.2 分类收藏（可选）
**功能描述**：
- 用户可以收藏感兴趣的分类（如"科技"、"小说"）
- 收藏分类后，用户可以在收藏页面快速查看该分类的新书

**实现方式**：
- 创建 `category_favorites` 表（可选）：
  ```sql
  CREATE TABLE category_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    favorited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, category)
  );
  ```

#### 2.4.3 通知拓展（可选）
**扩展目标**：在收藏功能基础上，未来可以进一步实现通知提醒，例如：
- 收藏的图书重新上架或可借时提醒
- 收藏的分类有新书添加时提醒

**实现方式（未来规划）**：
- 使用 Supabase Edge Functions、数据库触发器或外部任务调度，实现邮件/站内提醒

---

### 2.5 用户个人中心

#### 2.5.1 个人信息管理
- 查看和编辑个人资料：
  - 姓名
  - 邮箱（不可修改）
  - 电话
  - 地址
- 修改密码功能

#### 2.5.2 借阅统计
- 总借阅次数
- 当前借阅中的图书数量
- 历史借阅总时长
- 逾期记录统计

#### 2.5.3 我的收藏
- 已收藏的图书列表
- 已收藏的分类列表（如启用分类收藏）
- 管理收藏（取消收藏）

---

## 3. 数据库设计

### 3.1 新增数据表

#### 3.1.1 users 扩展表（必须）
用于存储用户的额外信息和权限：

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'librarian')),
  phone VARCHAR(20),
  address TEXT,
  member_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  max_borrow_limit INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3.1.2 borrowing_records 表（必须）
存储图书借阅记录：

```sql
CREATE TABLE borrowing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  borrowed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  returned_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'borrowed' 
    CHECK (status IN ('borrowed', 'returned', 'overdue', 'lost')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_borrowing_records_user_id ON borrowing_records(user_id);
CREATE INDEX idx_borrowing_records_book_id ON borrowing_records(book_id);
CREATE INDEX idx_borrowing_records_status ON borrowing_records(status);
```

#### 3.1.3 book_favorites 表（推荐）
存储用户收藏的图书：

```sql
CREATE TABLE book_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  favorited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

CREATE INDEX idx_book_favorites_user_id ON book_favorites(user_id);
CREATE INDEX idx_book_favorites_book_id ON book_favorites(book_id);
```

#### 3.1.4 category_favorites 表（可选）
存储用户收藏的分类：

```sql
CREATE TABLE category_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  favorited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category)
);

CREATE INDEX idx_category_favorites_user_id ON category_favorites(user_id);
```

#### 3.1.5 reviews 表（可选）
存储用户的图书评论和评分：

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

CREATE INDEX idx_reviews_book_id ON reviews(book_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
```

---

## 4. 界面路由设计

### 4.1 路由结构

```
用户界面路由 (/user)
├── /user/login              # 用户登录（管理员也可用此登录）
├── /user/register           # 用户注册（仅注册为普通用户）
├── /user/home               # 用户首页（图书列表）
├── /user/books              # 图书浏览页（带搜索和筛选）
├── /user/books/:id          # 图书详情页
├── /user/my-borrowings      # 我的借阅记录
├── /user/my-favorites       # 我的收藏
├── /user/profile            # 个人中心
└── /user/notifications      # 通知中心（可选）

管理员界面路由 (/admin)
├── /admin/login             # 管理员登录（也可以用用户登录）
├── /admin/dashboard         # 管理员仪表盘
├── /admin/books             # 图书管理
└── /admin/users             # 用户管理（可选）
```

**路由访问控制**：
- 普通用户：只能访问 `/user/*` 路由
- 管理员：可以访问 `/user/*` 和 `/admin/*` 所有路由
- 未登录用户：只能访问登录、注册页面和图书浏览（只读）

### 4.2 导航结构

#### 用户界面导航栏
```
Logo | 首页 | 图书浏览 | 我的借阅 | 我的收藏 | 个人中心 | [登出]

管理员登录时额外显示：
Logo | 首页 | 图书浏览 | 我的借阅 | 我的收藏 | 个人中心 | [管理后台] | [登出]
```

#### 管理员界面导航栏（现有）
```
Logo | 图书管理 | 用户管理 | [返回用户界面] | [登出]
```

---

## 5. 技术实现方案

### 5.1 前端架构

#### 5.1.1 目录结构（新增部分）
```
src/
├── components/
│   ├── admin/                 # 管理员界面组件（现有）
│   │   ├── BookList.tsx
│   │   ├── BookForm.tsx
│   │   └── ...
│   └── user/                  # 用户界面组件（新增）
│       ├── UserBookList.tsx   # 用户图书列表
│       ├── UserBookCard.tsx   # 用户图书卡片
│       ├── UserBookDetail.tsx # 图书详情页
│       ├── BorrowButton.tsx   # 借阅按钮
│       ├── FavoriteButton.tsx # 收藏按钮
│       ├── MyBorrowings.tsx   # 我的借阅
│       ├── MyFavorites.tsx    # 我的收藏
│       ├── UserProfile.tsx    # 用户个人中心
│       ├── UserLogin.tsx      # 用户登录
│       ├── UserRegister.tsx   # 用户注册
│       └── UserHeader.tsx     # 用户界面头部
├── contexts/
│   └── AuthContext.tsx        # 认证上下文（需扩展支持角色）
├── hooks/
│   ├── useBooks.ts            # 图书操作（现有）
│   ├── useBorrowings.ts       # 借阅操作（新增）
│   ├── useFavorites.ts        # 收藏操作（新增）
│   └── useUser.ts             # 用户信息操作（新增）
├── types/
│   ├── book.ts                # 图书类型（现有）
│   ├── borrowing.ts           # 借阅记录类型（新增）
│   ├── favorite.ts            # 收藏类型（新增）
│   └── user.ts                # 用户类型（新增）
└── pages/                     # 页面组件（新增）
    ├── admin/
    │   └── AdminDashboard.tsx
    └── user/
        ├── UserHome.tsx
        ├── UserBooks.tsx
        ├── UserBookDetail.tsx
        ├── UserBorrowings.tsx
        ├── UserFavorites.tsx
        └── UserProfile.tsx
```

#### 5.1.2 React Router 配置示例
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 根路径重定向 */}
        <Route path="/" element={<Navigate to="/user/home" />} />
        
        {/* 用户界面路由 */}
        <Route path="/user">
          <Route path="login" element={<UserLogin />} />
          <Route path="register" element={<UserRegister />} />
          <Route path="home" element={<UserHome />} />
          <Route path="books" element={<UserBooks />} />
          <Route path="books/:id" element={<UserBookDetail />} />
          <Route path="my-borrowings" element={<MyBorrowings />} />
          <Route path="my-favorites" element={<MyFavorites />} />
          <Route path="profile" element={<UserProfile />} />
        </Route>
        
        {/* 管理员界面路由 */}
        <Route path="/admin">
          <Route path="login" element={<AdminLogin />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="books" element={<AdminBooks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### 5.2 后端 API 设计（Supabase）

#### 5.2.1 借阅相关 API
```typescript
// useBorrowings.ts
import { supabase } from '../lib/supabaseClient';

export function useBorrowings() {
  // 借阅图书
  const borrowBook = async (bookId: string) => {
    // 1. 检查用户借阅限制
    const { data: currentBorrowings } = await supabase
      .from('borrowing_records')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'borrowed');
    
    if (currentBorrowings.length >= 5) {
      throw new Error('已达到借阅上限');
    }
    
    // 2. 检查图书可借数量
    const { data: book } = await supabase
      .from('books')
      .select('available_quantity')
      .eq('id', bookId)
      .single();
    
    if (book.available_quantity <= 0) {
      throw new Error('该图书暂无可借库存');
    }
    
    // 3. 创建借阅记录
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    const { error: borrowError } = await supabase
      .from('borrowing_records')
      .insert({
        book_id: bookId,
        user_id: userId,
        due_date: dueDate.toISOString(),
        status: 'borrowed'
      });
    
    // 4. 更新图书可借数量
    const { error: updateError } = await supabase
      .from('books')
      .update({ available_quantity: book.available_quantity - 1 })
      .eq('id', bookId);
  };
  
  // 归还图书
  const returnBook = async (borrowingId: string) => {
    // 1. 更新借阅记录
    const { data: record } = await supabase
      .from('borrowing_records')
      .update({
        returned_at: new Date().toISOString(),
        status: 'returned'
      })
      .eq('id', borrowingId)
      .select('book_id')
      .single();
    
    // 2. 更新图书可借数量
    const { data: book } = await supabase
      .from('books')
      .select('available_quantity')
      .eq('id', record.book_id)
      .single();
    
    await supabase
      .from('books')
      .update({ available_quantity: book.available_quantity + 1 })
      .eq('id', record.book_id);
  };
  
  // 获取用户的借阅记录
  const getUserBorrowings = async (userId: string) => {
    const { data, error } = await supabase
      .from('borrowing_records')
      .select(`
        *,
        books (
          id,
          title,
          author,
          cover_image_url
        )
      `)
      .eq('user_id', userId)
      .order('borrowed_at', { ascending: false });
    
    return data;
  };
  
  return { borrowBook, returnBook, getUserBorrowings };
}
```

#### 5.2.2 收藏相关 API
```typescript
// useFavorites.ts
import { supabase } from '../lib/supabaseClient';

export function useFavorites() {
  // 收藏图书
  const favoriteBook = async (bookId: string, userId: string) => {
    const { error } = await supabase
      .from('book_favorites')
      .insert({ book_id: bookId, user_id: userId });
    
    if (error) throw error;
  };
  
  // 取消收藏图书
  const unfavoriteBook = async (bookId: string, userId: string) => {
    const { error } = await supabase
      .from('book_favorites')
      .delete()
      .eq('book_id', bookId)
      .eq('user_id', userId);
    
    if (error) throw error;
  };
  
  // 获取用户收藏的图书
  const getUserFavoriteBooks = async (userId: string) => {
    const { data, error } = await supabase
      .from('book_favorites')
      .select(`
        *,
        books (
          id,
          title,
          author,
          cover_image_url,
          available_quantity
        )
      `)
      .eq('user_id', userId);
    
    return data;
  };
  
  // 收藏分类（可选）
  const favoriteCategory = async (category: string, userId: string) => {
    const { error } = await supabase
      .from('category_favorites')
      .insert({ category, user_id: userId });
    
    if (error) throw error;
  };
  
  return { 
    favoriteBook, 
    unfavoriteBook, 
    getUserFavoriteBooks,
    favoriteCategory 
  };
}
```

### 5.3 权限控制（RLS 策略）

#### 5.3.1 borrowing_records 表的 RLS
```sql
ALTER TABLE borrowing_records ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的借阅记录
CREATE POLICY "Users can view own borrowing records" ON borrowing_records
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能创建自己的借阅记录
CREATE POLICY "Users can create own borrowing records" ON borrowing_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的借阅记录
CREATE POLICY "Users can update own borrowing records" ON borrowing_records
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 管理员可以查看所有借阅记录
CREATE POLICY "Admins can view all borrowing records" ON borrowing_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 5.3.2 books 表的 RLS（调整）
```sql
-- 所有人可以读取图书（包括未登录用户）
CREATE POLICY "Anyone can read books" ON books
  FOR SELECT
  USING (true);

-- 只有管理员可以创建、修改、删除图书
CREATE POLICY "Only admins can manage books" ON books
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 5.3.3 book_favorites 表的 RLS
```sql
ALTER TABLE book_favorites ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的收藏
CREATE POLICY "Users can view own favorites" ON book_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能创建自己的收藏
CREATE POLICY "Users can create own favorites" ON book_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的收藏
CREATE POLICY "Users can delete own favorites" ON book_favorites
  FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 6. UI/UX 设计建议

### 6.1 设计风格
- **现代简约**：使用 Tailwind CSS 的组件设计
- **卡片布局**：图书展示以卡片为主，突出封面
- **响应式设计**：支持手机、平板、桌面端
- **色彩方案**：
  - 主色：蓝色系（#3B82F6）
  - 辅助色：绿色（成功）、红色（警告）、黄色（提醒）

### 6.2 关键页面设计

#### 6.2.1 用户首页（图书浏览）
```
┌─────────────────────────────────────────────────────────┐
│ [Logo]  首页  图书浏览  我的借阅  我的收藏  [👤 用户名] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  🔍 [搜索框]                    [分类筛选▼] [排序▼]      │
│                                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │  封面   │  │  封面   │  │  封面   │  │  封面   │    │
│  │  图片   │  │  图片   │  │  图片   │  │  图片   │    │
│  ├─────────┤  ├─────────┤  ├─────────┤  ├─────────┤    │
│  │ 书名    │  │ 书名    │  │ 书名    │  │ 书名    │    │
│  │ 作者    │  │ 作者    │  │ 作者    │  │ 作者    │    │
│  │ 可借:3/5│  │ 可借:0/5│  │ 可借:5/5│  │ 可借:2/2│    │
│  │[借阅]❤️│  │[缺货]❤️│  │[借阅]❤️│  │[借阅]❤️│    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
│                                                           │
│                      [加载更多]                           │
└─────────────────────────────────────────────────────────┘
```

#### 6.2.2 图书详情页
```
┌─────────────────────────────────────────────────────────┐
│ [返回列表]                                               │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────┐   《书名》                                  │
│  │         │                                              │
│  │  封面   │   作者：XXX                                  │
│  │  大图   │   出版社：XXX    出版年份：2023             │
│  │         │   分类：科技     ISBN：978XXXXXXXXXX        │
│  └─────────┘                                             │
│               库存：5 本    可借：3 本                    │
│                                                           │
│               [⭐ 收藏]     [📚 立即借阅]               │
│                                                           │
│  ─────────────────────────────────────────────────       │
│  简介：                                                   │
│  这是一本关于...的书籍...                                │
│                                                           │
│  ─────────────────────────────────────────────────       │
│  用户评价 ⭐⭐⭐⭐⭐ (4.5/5)                          │
│                                                           │
│  [用户A] ⭐⭐⭐⭐⭐                                   │
│  这本书写得很好...                                        │
│  2024-01-15                                              │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

#### 6.2.3 我的借阅页面
```
┌─────────────────────────────────────────────────────────┐
│ 我的借阅记录                                             │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [当前借阅] [历史借阅]                                   │
│                                                           │
│  ┌───────────────────────────────────────────────┐      │
│  │ 《书名1》                            [归还]   │      │
│  │ 作者：XXX                                     │      │
│  │ 借阅日期：2024-01-01                          │      │
│  │ 到期日期：2024-01-31  ⏰ 剩余 5 天           │      │
│  └───────────────────────────────────────────────┘      │
│                                                           │
│  ┌───────────────────────────────────────────────┐      │
│  │ 《书名2》                            [归还]   │      │
│  │ 作者：YYY                                     │      │
│  │ 借阅日期：2024-01-05                          │      │
│  │ 到期日期：2024-02-04  ⏰ 剩余 10 天          │      │
│  └───────────────────────────────────────────────┘      │
│                                                           │
│  借阅统计：已借 5/5 本（已达上限）                       │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 7. 实施计划

### 7.1 第一阶段：核心功能（必须）
**时间估计：2-3 周**

1. **数据库准备**（1-2 天）
   - 创建 `users` 扩展表
   - 创建 `borrowing_records` 表
   - 配置 RLS 策略

2. **用户认证**（3-4 天）
   - 用户注册/登录组件
   - 角色区分（admin/user）
   - 路由保护和权限控制

3. **图书浏览功能**（4-5 天）
   - 用户图书列表组件
   - 图书详情页组件
   - 搜索和筛选功能

4. **借阅功能**（5-6 天）
   - 借阅按钮和逻辑
   - 我的借阅记录页面
   - 归还功能
   - 借阅限制检查

### 7.2 第二阶段：增强功能（推荐）
**时间估计：1-2 周**

1. **订阅功能**（3-4 天）
   - 图书订阅/取消订阅
   - 分类订阅
   - 我的订阅页面

2. **用户中心**（2-3 天）
   - 个人信息管理
   - 借阅统计展示
   - 密码修改

3. **UI 优化**（2-3 天）
   - 响应式设计完善
   - 动画效果
   - 加载状态优化

### 7.3 第三阶段：扩展功能（可选）
**时间估计：1-2 周**

1. **评论系统**（3-4 天）
   - 图书评分
   - 评论发表和展示

2. **通知系统**（3-4 天）
   - 到期提醒
   - 订阅通知

3. **高级功能**（按需）
   - 图书推荐算法
   - 借阅历史分析
   - 社交功能（书友推荐）

---

## 8. 技术要点

### 8.1 认证流程

#### 8.1.1 用户注册时同步创建 users 记录
```typescript
// 注册时的处理
const handleRegister = async (email: string, password: string, fullName: string) => {
  // 1. 使用 Supabase Auth 注册
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (authError) throw authError;
  
  // 2. 在 users 表中创建扩展记录
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      role: 'user',
    });
  
  if (userError) throw userError;
};
```

#### 8.1.2 角色检查
```typescript
// AuthContext 中的角色检查
const getUserRole = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  
  return data?.role || 'user';
};
```

### 8.2 借阅逻辑的事务处理

由于 Supabase 不直接支持客户端事务，需要使用以下方案：

1. **方案一：使用 PostgreSQL 函数（推荐）**
```sql
CREATE OR REPLACE FUNCTION borrow_book(
  p_user_id UUID,
  p_book_id UUID
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_current_borrowings INTEGER;
  v_available_quantity INTEGER;
  v_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 1. 检查用户借阅数量
  SELECT COUNT(*) INTO v_current_borrowings
  FROM borrowing_records
  WHERE user_id = p_user_id AND status = 'borrowed';
  
  IF v_current_borrowings >= 5 THEN
    RETURN json_build_object('error', '已达到借阅上限');
  END IF;
  
  -- 2. 检查图书可借数量
  SELECT available_quantity INTO v_available_quantity
  FROM books
  WHERE id = p_book_id;
  
  IF v_available_quantity <= 0 THEN
    RETURN json_build_object('error', '该图书暂无可借库存');
  END IF;
  
  -- 3. 计算到期日期（30天后）
  v_due_date := NOW() + INTERVAL '30 days';
  
  -- 4. 创建借阅记录
  INSERT INTO borrowing_records (book_id, user_id, due_date, status)
  VALUES (p_book_id, p_user_id, v_due_date, 'borrowed');
  
  -- 5. 更新图书可借数量
  UPDATE books
  SET available_quantity = available_quantity - 1
  WHERE id = p_book_id;
  
  RETURN json_build_object('success', true, 'due_date', v_due_date);
END;
$$ LANGUAGE plpgsql;
```

2. **方案二：使用乐观锁**
在前端进行多步操作，并处理并发冲突。

### 8.3 逾期检查

#### 使用 PostgreSQL 定时任务或 Edge Functions
```sql
-- 创建一个函数来标记逾期记录
CREATE OR REPLACE FUNCTION mark_overdue_borrowings()
RETURNS void AS $$
BEGIN
  UPDATE borrowing_records
  SET status = 'overdue'
  WHERE status = 'borrowed'
    AND due_date < NOW()
    AND returned_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 使用 pg_cron 扩展定时执行（如果 Supabase 支持）
-- SELECT cron.schedule('mark-overdue', '0 0 * * *', 'SELECT mark_overdue_borrowings()');
```

或在前端查询时动态判断：
```typescript
const getBorrowingsWithStatus = async (userId: string) => {
  const { data } = await supabase
    .from('borrowing_records')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'borrowed');
  
  // 前端判断是否逾期
  return data?.map(record => ({
    ...record,
    isOverdue: new Date(record.due_date) < new Date() && !record.returned_at
  }));
};
```

---

## 9. 安全考虑

### 9.1 权限控制
- 所有敏感操作必须验证用户身份
- 使用 RLS 策略防止数据泄露
- 管理员和普通用户权限严格区分

### 9.2 输入验证
- 前端表单验证
- 后端通过 RLS 和数据库约束验证
- 防止 SQL 注入（Supabase 客户端自动处理）

### 9.3 借阅限制
- 每用户最多 5 本
- 图书可借数量不能为负数
- 防止重复借阅同一本书

---

## 10. 测试计划

### 10.1 功能测试
- [ ] 用户注册和登录
- [ ] 图书浏览和搜索
- [ ] 借阅功能（正常流程）
- [ ] 借阅限制检查（达到上限、库存不足）
- [ ] 归还功能
- [ ] 收藏和取消收藏
- [ ] 逾期检测

### 10.2 权限测试
- [ ] 普通用户不能访问管理员功能
- [ ] 未登录用户只能浏览图书
- [ ] 用户只能查看自己的借阅记录

### 10.3 性能测试
- [ ] 大量图书的加载速度
- [ ] 并发借阅的处理
- [ ] 数据库查询优化

---

## 11. 未来扩展方向

### 11.1 高级功能
- 📊 **数据分析仪表盘**：借阅趋势、热门图书统计
- 🤖 **智能推荐**：基于借阅历史和收藏的个性化推荐
- 💬 **社交功能**：书友系统、借阅分享
- 📱 **移动应用**：React Native 或 Flutter 开发原生 App
- 📧 **邮件通知**：到期提醒、收藏图书上架通知邮件

### 11.2 技术优化
- 🚀 **缓存机制**：Redis 缓存热门图书数据
- 🔍 **全文搜索**：使用 PostgreSQL 的全文搜索或 Elasticsearch
- 📸 **OCR 识别**：扫描图书 ISBN 自动添加
- 🎨 **主题切换**：暗色模式支持

---

## 12. 参考资源

### 12.1 技术文档
- [Supabase 官方文档](https://supabase.com/docs)
- [React Router 文档](https://reactrouter.com/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)

### 12.2 相关项目
- 现有的管理员界面代码库
- [SUPABASE_TABLES_PROPOSAL.md](./SUPABASE_TABLES_PROPOSAL.md) - 完整数据表设计

---

## 13. 总结

本文档详细描述了图书管理系统用户界面的设计方案，包括：

✅ **核心功能**：图书浏览、借阅、归还、收藏
✅ **权限系统**：基于数据库 role 字段的权限管理，管理员可访问所有界面
✅ **技术方案**：前端组件设计、后端 API、数据库设计、RLS 策略
✅ **实施计划**：分阶段开发，优先核心功能

该用户界面将与现有的管理员界面协同工作，为普通用户提供完整的图书借阅体验。管理员不仅可以使用管理功能，也可以正常使用用户界面的所有功能。建议按照第一阶段（核心功能）→ 第二阶段（增强功能）→ 第三阶段（扩展功能）的顺序逐步实现。

---

**文档版本**：v2.0  
**创建日期**：2024-11-01  
**最后更新**：2024-11-01  
**维护者**：开发团队

**v2.0 更新说明**：
- ✅ 明确了权限系统实现原理（基于数据库 role 字段而非 Supabase Auth）
- ✅ 管理员可以访问用户界面的所有功能
- ✅ 将"订阅功能"改为"收藏功能"，更符合实际使用场景
- ✅ 添加了详细的权限管理操作步骤
