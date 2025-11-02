# 可选 SQL 脚本

这个目录包含一些可选的 SQL 脚本，用于特定场景或高级功能。

**注意**：基本部署不需要这些脚本，所有必需的 SQL 都已包含在项目根目录的 README.md 中。

## 脚本说明

### MIGRATION.sql
- 从旧版本迁移到当前版本的脚本
- 添加封面图片字段和认证策略
- 仅在从旧版本升级时需要

### STORAGE_SETUP.sql
- 存储桶的 RLS 策略配置
- 已包含在主 README.md 的图片上传部分

### fix_policy_recursion.sql
- 修复用户表的 RLS 无限递归问题
- 仅在遇到特定错误时使用

### FIX_BORROW_FUNCTION.sql
- 借阅功能相关（当前版本未实现）
- 为未来扩展保留

### USER_TABLES_MIGRATION.sql
- 用户表和借阅功能相关迁移
- 为未来扩展保留

## 使用建议

首次部署请直接按照主 README.md 操作，无需执行这些脚本。
