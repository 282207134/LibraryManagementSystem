# 快速修复指南 - 无限递归错误

## 问题说明

您遇到的错误：`infinite recursion detected in policy for relation "users"`

这是因为数据库的 RLS (Row Level Security) 策略配置有问题。

## 修复步骤（只需 2 分钟）

### 步骤 1：打开 Supabase SQL 编辑器

1. 登录 Supabase Dashboard
2. 点击左侧菜单 **SQL Editor**

### 步骤 2：运行修复脚本

1. 点击 **New Query** 创建新查询
2. 复制 `fix_policy_recursion.sql` 文件的全部内容
3. 粘贴到 SQL 编辑器
4. 点击 **Run** 或按 Ctrl+Enter 运行

### 步骤 3：验证修复

运行以下查询确认管理员用户存在：

```sql
SELECT * FROM users WHERE email = 'liu282207134@yahoo.co.jp';
```

应该能看到您的管理员账户，role 列应该是 'admin'。

### 步骤 4：重新登录应用

1. 刷新浏览器页面
2. 使用管理员账号登录：
   - 邮箱：`liu282207134@yahoo.co.jp`
   - 密码：您设置的密码
3. 现在应该能看到管理员界面了！

## 问题原因

原来的策略在读取 users 表时会检查用户是否是管理员，但检查管理员身份又需要读取 users 表，造成了死循环。

修复方法是使用 `SECURITY DEFINER` 函数来打破这个循环。

## 如果还有问题

如果运行脚本后还是看不到管理员界面，请检查：

1. 用户的 role 是否确实是 'admin'（不是 'user'）
2. 浏览器控制台是否还有 "infinite recursion" 错误
3. 尝试清除浏览器缓存并重新登录

## 需要帮助？

查看详细文档：`FIX_POLICY_RECURSION.md`
