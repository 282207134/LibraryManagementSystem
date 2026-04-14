# 数据库文档

本文档描述当前项目实际依赖的数据库结构与策略约束。

## 1. 核心表

### `books`

图书主数据。

关键字段：

- `id` UUID PK
- `title`、`author` 必填
- `isbn` 唯一（可空）
- `quantity`、`available_quantity`（`available_quantity <= quantity`）
- `cover_image_url`
- `created_at`、`updated_at`

### `users`

`auth.users` 的扩展资料表（当前项目必需）。

关键字段：

- `id`（FK -> `auth.users.id`）
- `email`、`full_name`
- `role`（`user` / `admin`）
- `phone`、`address`
- `max_borrow_limit`

### `borrowing_records`

借阅流水。

关键字段：

- `book_id`、`user_id`
- `borrowed_at`、`due_date`、`returned_at`
- `status`（`borrowed` / `returned` / `overdue` / `lost`）

### `book_favorites`

用户收藏。

- 唯一约束：`(user_id, book_id)`

### `reviews`

评论与评分。

- 每用户每本书一条记录（建议唯一约束）
- `rating` 范围 1~5

## 2. RLS 与权限模型

当前项目使用“前端路由守卫 + RLS 双层控制”，以 RLS 为最终安全边界。

建议策略要点：

- `books`：已登录用户可读；写操作按业务需要限制（可管理员专属）
- `users`：用户可读写自己，管理员可读全部
- `borrowing_records`：用户读自己的记录，管理员可读全部
- `book_favorites`：用户仅操作自己的收藏
- `reviews`：用户可读全部、仅写自己的评论

## 3. 关键函数（RPC）

前端 `useBorrowings` 依赖以下 RPC 名称与参数：

### `borrow_book`

- 参数：`p_book_id`、`p_user_id`、`p_days`
- 期望返回：JSON，至少包含 `success`，可附带 `due_date` 或 `error`

### `return_book`

- 参数：`p_borrowing_id`
- 期望返回：JSON，至少包含 `success`，失败返回 `error`

> 这两个函数需要保证库存变更与记录变更的原子性（建议事务内完成）。

## 4. 管理员函数

### `is_admin()`

用于 RLS 中判定管理员身份，建议使用 `SECURITY DEFINER` 并固定 `search_path`，避免策略递归问题。

## 5. 索引建议

- `books(title)`、`books(author)`、`books(category)`
- `borrowing_records(user_id)`、`borrowing_records(book_id)`、`borrowing_records(status)`
- `book_favorites(user_id, book_id)` 唯一索引
- `reviews(book_id)`、`reviews(user_id)`

## 6. 存储（封面）

- bucket：`book-covers`
- 前端通过 `storageHelper.ts` 上传、替换、删除封面
- 需要配置对应 `storage.objects` 策略，确保上传/读取可用

## 7. 迁移建议

优先使用仓库 SQL：

- `MIGRATION.sql`
- `USER_TABLES_MIGRATION.sql`
- `FIX_BORROW_FUNCTION.sql`
- `STORAGE_SETUP.sql`

并在每次调整后验证：

1. 普通用户读写边界  
2. 管理员跨用户读取能力  
3. 借阅/归还是否正确更新库存  
4. 评论与收藏是否符合唯一约束
