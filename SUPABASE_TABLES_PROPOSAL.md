# Supabase 表与 SQL 方案（当前版）

本文档给出与当前前端代码一致的最小可运行数据库方案。

## 1. 必需对象清单

### 表

- `books`
- `users`
- `borrowing_records`
- `book_favorites`
- `reviews`

### 函数

- `is_admin()`
- `borrow_book(p_book_id uuid, p_user_id uuid, p_days int)`
- `return_book(p_borrowing_id uuid)`

### 存储

- bucket：`book-covers`

## 2. 表结构建议（概要）

### `books`

- 图书主数据，含库存与可借数量
- 关键约束：`available_quantity >= 0` 且 `available_quantity <= quantity`

### `users`

- `id` 关联 `auth.users(id)`
- 包含 `role`（`user` / `admin`）和扩展资料

### `borrowing_records`

- 存储借阅状态流转（borrowed/returned/overdue/lost）
- 关联 `books` 与 `auth.users`

### `book_favorites`

- 用户图书收藏
- 唯一键 `(user_id, book_id)`

### `reviews`

- 用户评分评论
- 建议唯一键 `(book_id, user_id)`

## 3. RLS 策略建议（与前端行为匹配）

- `books`：认证用户可读，写权限按业务限制（管理员优先）
- `users`：用户可读写自己；管理员可读全部
- `borrowing_records`：用户可读自己；管理员可读全部
- `book_favorites`：用户只操作自己的收藏
- `reviews`：认证用户可读；用户仅维护自己的评论

## 4. 关键函数契约

前端调用约定（必须保持）：

### `borrow_book`

- 入参：`p_book_id`、`p_user_id`、`p_days`
- 返回：JSON（`success`、`error`、可选 `due_date`）

### `return_book`

- 入参：`p_borrowing_id`
- 返回：JSON（`success`、`error`）

> 当前前端假定 RPC 返回 JSON，不建议改为返回裸 UUID/VOID。

## 5. 推荐执行顺序

1. 执行 `MIGRATION.sql`
2. 执行 `USER_TABLES_MIGRATION.sql`
3. 执行 `FIX_BORROW_FUNCTION.sql`
4. 执行 `STORAGE_SETUP.sql`
5. 按需导入 `测试图书数据.sql`

## 6. 验证 SQL（建议）

```sql
select is_admin();
select * from books limit 1;
select * from users limit 1;
```

并登录普通用户与管理员各验证一次：

- 普通用户不能访问管理员页面
- 管理员可读取全量借阅记录
- 借阅/归还可正确变更库存
