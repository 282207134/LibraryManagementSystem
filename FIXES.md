# 修复说明文档

## 问题 1: 借阅功能数据库函数重载错误

### 问题描述
```
借阅失败：Could not choose the best candidate function between: 
public.borrow_book(p_user_id => uuid, p_book_id => uuid), 
public.borrow_book(p_book_id => uuid, p_user_id => uuid, p_days => integer)
```

### 原因
Supabase 数据库中存在两个同名的 `borrow_book` 函数，它们的参数不同：
1. `borrow_book(p_user_id, p_book_id)` - 两个参数版本
2. `borrow_book(p_book_id, p_user_id, p_days)` - 三个参数版本

当调用时只传递两个参数，数据库无法确定应该使用哪个函数版本。

### 解决方案
修改了 `/src/hooks/useBorrowings.ts` 文件：
- 明确调用三个参数的函数版本
- 添加 `p_days` 参数（默认值为 30 天）
- 确保参数顺序与数据库函数签名一致

```typescript
// 修改前
const { data, error: rpcError } = await supabase.rpc('borrow_book', {
  p_user_id: userId,
  p_book_id: bookId,
});

// 修改后
const { data, error: rpcError } = await supabase.rpc('borrow_book', {
  p_book_id: bookId,
  p_user_id: userId,
  p_days: days,  // 添加第三个参数
});
```

### 数据库操作建议
为避免函数重载冲突，建议在 Supabase 中：
1. 删除旧的两参数版本的 `borrow_book` 函数
2. 或者重命名其中一个函数以避免冲突

SQL 命令（在 Supabase SQL Editor 中执行）：
```sql
-- 删除旧的两参数版本（如果存在）
DROP FUNCTION IF EXISTS borrow_book(uuid, uuid);

-- 或者查看所有 borrow_book 函数版本
SELECT proname, oidvectortypes(proargtypes) as argument_types
FROM pg_proc 
WHERE proname = 'borrow_book';
```

---

## 问题 2: 管理员界面无法访问

### 问题描述
用户报告"没有发现管理员界面"，无法进入管理后台。

### 原因
1. AdminApp 组件没有正确处理路由，访问 `/admin/dashboard` 时没有对应的路由配置
2. 用户界面的导航中管理员按钮不够明显
3. 缺少直接访问管理后台的便捷入口

### 解决方案

#### 1. 修复 AdminApp 路由配置
在 `/src/AdminApp.tsx` 中添加了 React Router 路由：

```typescript
function AdminApp() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<BooksDashboard />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}
```

#### 2. 增强用户界面的管理员入口
在 `/src/components/user/UserHeader.tsx` 中：
- 在导航菜单中保留了"管理后台"链接（桌面端可见）
- 在用户信息区域添加了红色的"管理后台"按钮（所有设备可见）
- 更加醒目，方便管理员快速进入后台

### 访问方式
管理员可以通过以下方式访问后台：
1. 点击页面右上角的红色"管理后台"按钮
2. 点击导航栏中的"管理后台"链接
3. 直接访问 URL: `/admin` 或 `/admin/dashboard`

### 权限要求
只有 `role = 'admin'` 的用户才能访问管理后台，普通用户会被重定向到用户首页。

---

## 测试建议

### 测试借阅功能
1. 确保数据库中只有一个 `borrow_book` 函数版本
2. 登录用户界面
3. 浏览图书列表
4. 点击"立即借阅"按钮
5. 检查是否成功借阅并显示到期日期

### 测试管理员界面
1. 使用管理员账号登录（确保 users 表中 role = 'admin'）
2. 查看页面右上角是否显示"管理员"标签和红色"管理后台"按钮
3. 点击"管理后台"按钮
4. 确认成功进入管理后台（/admin/dashboard）
5. 测试图书的增删改查功能

---

## 后续优化建议

1. **数据库函数统一**：建议清理数据库中的重复函数，保持一个统一的版本
2. **管理员界面增强**：可以添加更多管理功能，如：
   - 用户管理
   - 借阅记录管理
   - 统计报表
3. **错误处理改进**：为借阅失败提供更友好的错误提示
4. **移动端优化**：为移动端添加响应式的管理员入口菜单
