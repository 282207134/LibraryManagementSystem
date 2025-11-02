# 修复说明：Supabase RLS 策略无限递归问题

## 问题描述

当管理员用户尝试访问 users 表时，系统报错：

```
GET /rest/v1/users?select=*&id=eq.2d72f38a... 500 (Internal Server Error)
加载用户信息失败 {
  code: '42P17',
  message: 'infinite recursion detected in policy for relation "users"'
}
```

即使您已经完成了以下操作：
- ✅ 在 Supabase Authentication 中创建了用户账号
- ✅ 在 users 数据表中手动添加了该用户记录
- ✅ 将该用户的 `role` 字段设置为 `'admin'`

但仍然无法看到管理员界面，浏览器控制台持续报告递归错误。

## 问题根源

### 循环依赖的本质

问题出在 `users` 表的 RLS (Row Level Security，行级安全策略) 配置上。原策略代码如下：

```sql
-- ❌ 有问题的策略（造成循环依赖）
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users  -- ⚠️ 在查询 users 表时又去查 users 表！
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 执行流程分析

1. 前端代码尝试查询 `users` 表以获取用户资料
2. PostgreSQL 触发该表的 SELECT 策略进行权限校验
3. 策略内部的 `EXISTS` 子查询再次访问 `users` 表
4. 访问 `users` 表又会触发同一个 SELECT 策略
5. 策略内部再次执行 `EXISTS` 查询...
6. **无限循环，直到数据库检测到递归并抛出错误**

### 影响范围

同样的问题存在于以下表的策略：
- ❌ `users` 表 - 所有管理员相关策略
- ❌ `borrowing_records` 表 - 管理员查看/修改借阅记录的策略
- ❌ 其他任何需要检查用户角色的表

## 解决方案

### 核心思路

使用 **SECURITY DEFINER 函数**来打破循环依赖。这类函数以创建者的权限执行，运行时**绕过 RLS 策略**，从而可以安全地读取 `users` 表而不触发递归。

### 修复前后对比

#### 修复前（有问题）：
```sql
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users  -- ❌ 触发策略 → 再次触发策略 → 无限递归
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 修复后（正确）：
```sql
-- ✅ 步骤 1：创建安全定义函数
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER          -- 关键：以创建者权限执行，绕过 RLS
SET search_path = public  -- 安全设置：明确指定 schema
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users   -- ✅ 不会触发策略，因为函数以 DEFINER 权限运行
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- ✅ 步骤 2：策略调用函数
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  USING (is_admin());     -- ✅ 调用函数，无递归
```

### 工作原理

1. **策略触发**：当查询 `users` 表时，策略被激活
2. **函数调用**：策略调用 `is_admin()` 函数
3. **权限提升**：函数以 SECURITY DEFINER 模式执行，拥有创建者（通常是超级用户）权限
4. **绕过 RLS**：函数内部查询 `users` 表时不会触发任何 RLS 策略
5. **返回结果**：函数返回布尔值给策略，策略据此决定是否允许访问
6. **完成查询**：没有循环，正常返回数据

## 应用修复

### 第一步：打开 Supabase SQL 编辑器

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择您的项目
3. 点击左侧菜单 **SQL Editor** 图标
4. 点击右上角 **New Query** 创建新查询

### 第二步：执行修复脚本

1. 打开项目文件 `fix_policy_recursion.sql`
2. 复制全部内容（约 126 行）
3. 粘贴到 Supabase SQL 编辑器
4. 点击右下角绿色 **Run** 按钮（或快捷键 `Ctrl+Enter`）

### 第三步：验证修复效果

在 SQL 编辑器中依次运行以下查询：

```sql
-- 查询 1：确认管理员用户存在
SELECT id, email, role, full_name 
FROM users 
WHERE email = 'liu282207134@yahoo.co.jp';
-- 预期结果：显示一条记录，role = 'admin'

-- 查询 2：测试 is_admin() 函数
SELECT is_admin();
-- 预期结果：如果您当前以管理员身份登录，返回 true

-- 查询 3：测试策略是否工作
SELECT COUNT(*) FROM users;
-- 预期结果：能正常返回总用户数，不报错
```

### 第四步：刷新前端应用

1. 回到图书管理系统网页
2. 按 `Ctrl+Shift+R` (Windows/Linux) 或 `Cmd+Shift+R` (Mac) 强制刷新
3. 使用管理员账号登录：
   - **邮箱**：`liu282207134@yahoo.co.jp`
   - **密码**：您之前设置的密码
4. ✨ 现在应该能看到管理员界面了！

## 修复内容详解

修复脚本 `fix_policy_recursion.sql` 完成了以下工作：

### 1. 创建安全函数 `is_admin()`
```sql
-- 该函数可安全地检查当前用户是否为管理员
-- SECURITY DEFINER 确保以创建者权限执行，绕过 RLS
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;
```

### 2. 修复 `users` 表的管理员策略
```sql
-- 删除旧的有问题的策略
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;

-- 创建新的无递归策略
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can update all users" ON users
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (is_admin());
```

### 3. 修复 `borrowing_records` 表策略
```sql
-- 同样的方法修复借阅记录表的管理员权限
CREATE POLICY "Admins can view all borrowing records" ON borrowing_records
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can update all borrowing records" ON borrowing_records
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete borrowing records" ON borrowing_records
  FOR DELETE USING (is_admin());
```

### 4. 补充其他表的管理员策略
- `book_favorites` - 管理员可查看和删除所有收藏
- `reviews` - 管理员可修改和删除所有评论
- `books` - 管理员可执行所有操作

### 5. 自动创建用户档案
```sql
-- 当新用户通过 Supabase Auth 注册时，自动在 users 表创建记录
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 绑定触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## 预期效果

修复完成后，系统应该能够正常工作：

### 管理员功能
- ✅ 登录后自动加载用户资料（不再报 500 错误）
- ✅ 显示管理员专用界面
- ✅ 可以查看所有用户列表
- ✅ 可以管理所有图书（增删改查）
- ✅ 可以查看所有借阅记录
- ✅ 可以管理用户收藏和评论

### 控制台清洁
- ✅ 不再出现 "infinite recursion" 错误
- ✅ 不再出现 500 Internal Server Error
- ✅ 用户资料查询成功返回 200 状态

### 新用户注册
- ✅ 通过前端注册的新用户自动在 users 表创建记录
- ✅ 无需手动在数据库添加用户
- ✅ 新用户默认角色为 'user'

## 技术原理深入

### SECURITY DEFINER 的作用

在 PostgreSQL 中，函数有两种执行模式：

1. **SECURITY INVOKER**（默认）
   - 以**调用者**的权限执行
   - 受调用者的 RLS 策略约束
   - ❌ 在策略中调用会触发递归

2. **SECURITY DEFINER**（本方案采用）
   - 以**函数创建者**的权限执行
   - **不受** RLS 策略约束
   - ✅ 可以安全地在策略中调用

### 安全性考虑

使用 SECURITY DEFINER 需要注意安全：

```sql
SET search_path = public  -- ✅ 必须设置，防止 schema 注入攻击
```

这确保函数始终访问正确的 `public.users` 表，而非恶意用户创建的同名表。

### 为什么普通用户无法滥用

虽然 `is_admin()` 函数以高权限执行，但：
- ✅ 函数内部使用 `auth.uid()` 获取当前登录用户 ID
- ✅ `auth.uid()` 由 Supabase 提供，无法伪造
- ✅ 函数仅返回布尔值，不泄露敏感信息
- ✅ 普通用户无法修改自己的 `role` 字段（受其他策略保护）

## 常见问题

### Q1：运行脚本后仍然报错怎么办？

**检查清单：**
1. 确认脚本完整执行，没有中途报错
2. 验证函数已创建：`SELECT is_admin();`
3. 检查用户的 role 字段是否真的是 `'admin'`（不是 `'user'` 或其他值）
4. 完全退出登录，清除浏览器缓存，重新登录

**调试步骤：**
```sql
-- 检查函数是否存在
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname = 'is_admin';
-- 预期：找到一条记录，prosecdef = true

-- 检查策略是否正确
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'users';
-- 预期：看到使用 is_admin() 的策略

-- 检查当前用户信息
SELECT auth.uid(), u.email, u.role
FROM users u
WHERE u.id = auth.uid();
-- 预期：显示您的邮箱和角色
```

### Q2：book_favorites 表找不到？

错误信息：
```
Could not find the table 'public.book_favorites' in the schema cache
```

**原因：**
您可能还没有运行完整的表结构迁移。

**解决方法：**
1. 先运行 `USER_TABLES_MIGRATION.sql` 创建所有表
2. 再运行 `fix_policy_recursion.sql` 修复策略

### Q3：如何添加更多管理员？

有两种方法：

**方法 1：通过 SQL**
```sql
-- 将现有用户升级为管理员
UPDATE users 
SET role = 'admin' 
WHERE email = '要升级的邮箱地址';

-- 验证修改
SELECT email, role FROM users WHERE role = 'admin';
```

**方法 2：通过管理员界面**（修复后可用）
1. 以管理员身份登录
2. 进入用户管理页面
3. 找到目标用户，将其角色修改为 admin

### Q4：触发器什么时候生效？

`handle_new_user()` 触发器在以下情况自动执行：
- ✅ 用户通过前端注册表单注册
- ✅ 通过 Supabase Auth API 创建新用户
- ✅ 在 Supabase Dashboard 的 Authentication 页面手动添加用户

**不会执行的情况：**
- ❌ 直接在 users 表 INSERT 记录（不经过 auth.users）
- ❌ 修复前已创建的用户（触发器不会补充历史数据）

### Q5：如何验证修复是否成功？

运行完整测试：

```sql
-- 测试 1：函数基础功能
SELECT is_admin() AS am_i_admin;

-- 测试 2：读取 users 表（不应报错）
SELECT COUNT(*) AS total_users FROM users;

-- 测试 3：读取 borrowing_records 表
SELECT COUNT(*) AS total_records FROM borrowing_records;

-- 测试 4：触发器功能（创建测试用户）
INSERT INTO auth.users (id, email)
VALUES (gen_random_uuid(), 'test@example.com')
RETURNING id;
-- 然后检查 users 表是否自动创建了记录
SELECT * FROM users WHERE email = 'test@example.com';
-- 清理测试数据
DELETE FROM users WHERE email = 'test@example.com';
```

## 额外收益

除了修复递归问题，这次更新还带来了以下改进：

### 1. 统一的权限管理
所有表使用同一个 `is_admin()` 函数，逻辑一致，易于维护。

### 2. 自动化用户注册流程
新用户注册时自动创建档案，无需手动干预。

### 3. 完整的管理员权限体系
管理员可以管理系统的所有资源，不受普通用户策略限制。

### 4. 更好的错误处理
消除了循环依赖，减少了 500 错误的可能性。

## 相关文件

- `fix_policy_recursion.sql` - 完整的 SQL 修复脚本（带中文注释）
- `USER_TABLES_MIGRATION.sql` - 原始表结构迁移脚本
- `README_FIX_ADMIN.md` - 用户友好的中文修复指南
- `QUICK_FIX_GUIDE.md` - 2 分钟快速修复指南
- `FIX_POLICY_RECURSION.md` - 英文技术文档
- `SOLUTION_SUMMARY.md` - 解决方案总结

## 注意事项

### 执行脚本前
- ⚠️ 建议在测试环境先运行
- ⚠️ 生产环境建议先备份数据库
- ⚠️ 确认您有足够的数据库权限

### 脚本幂等性
- ✅ 可以安全地重复运行
- ✅ 使用 `DROP IF EXISTS` 避免冲突
- ✅ 使用 `ON CONFLICT DO NOTHING` 防止重复插入

### 性能影响
- ✅ `is_admin()` 函数执行很快（简单的 EXISTS 查询）
- ✅ 不会显著影响查询性能
- ✅ 建议为 users(id, role) 创建复合索引（如果数据量大）

## 总结

**问题**：RLS 策略循环依赖导致无限递归  
**根源**：策略在检查权限时查询自身表  
**方案**：使用 SECURITY DEFINER 函数打破循环  
**效果**：管理员可正常访问所有功能  

修复后，您的图书管理系统将拥有完善的权限体系和流畅的用户体验！

---

**如有任何疑问，请查阅其他文档或检查 Supabase 日志以获取更多信息。** 📚✨
