-- =====================================================
-- 修复 borrow_book 函数重载冲突
-- =====================================================
-- 此脚本解决数据库中存在多个 borrow_book 函数导致的冲突问题
-- 执行前请先备份数据库！

-- 1. 查看当前所有 borrow_book 函数版本
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'borrow_book'
  AND n.nspname = 'public';

-- 2. 删除旧的两参数版本（如果存在）
DROP FUNCTION IF EXISTS public.borrow_book(p_user_id UUID, p_book_id UUID);

-- 3. 确保只保留或创建三参数版本
-- 如果您需要创建新的三参数版本，请使用以下代码：

CREATE OR REPLACE FUNCTION public.borrow_book(
  p_book_id UUID,
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_current_borrowings INTEGER;
  v_available_quantity INTEGER;
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_max_borrow_limit INTEGER;
BEGIN
  -- 1. 获取用户的借阅上限
  SELECT max_borrow_limit INTO v_max_borrow_limit
  FROM users
  WHERE id = p_user_id;
  
  IF v_max_borrow_limit IS NULL THEN
    v_max_borrow_limit := 5; -- 默认值
  END IF;
  
  -- 2. 检查用户当前借阅数量
  SELECT COUNT(*) INTO v_current_borrowings
  FROM borrowing_records
  WHERE user_id = p_user_id AND status = 'borrowed';
  
  IF v_current_borrowings >= v_max_borrow_limit THEN
    RETURN json_build_object('success', false, 'error', '已达到借阅上限');
  END IF;
  
  -- 3. 检查图书可借数量
  SELECT available_quantity INTO v_available_quantity
  FROM books
  WHERE id = p_book_id;
  
  IF v_available_quantity IS NULL THEN
    RETURN json_build_object('success', false, 'error', '图书不存在');
  END IF;
  
  IF v_available_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', '该图书暂无可借库存');
  END IF;
  
  -- 4. 检查是否已借阅此书
  IF EXISTS (
    SELECT 1 FROM borrowing_records
    WHERE user_id = p_user_id AND book_id = p_book_id AND status = 'borrowed'
  ) THEN
    RETURN json_build_object('success', false, 'error', '您已借阅此书');
  END IF;
  
  -- 5. 计算到期日期（使用传入的天数参数）
  v_due_date := NOW() + (p_days || ' days')::INTERVAL;
  
  -- 6. 创建借阅记录
  INSERT INTO borrowing_records (book_id, user_id, due_date, status)
  VALUES (p_book_id, p_user_id, v_due_date, 'borrowed');
  
  -- 7. 更新图书可借数量
  UPDATE books
  SET available_quantity = available_quantity - 1
  WHERE id = p_book_id;
  
  RETURN json_build_object('success', true, 'due_date', v_due_date);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 授予执行权限
GRANT EXECUTE ON FUNCTION public.borrow_book(UUID, UUID, INTEGER) TO authenticated;

-- 5. 验证修复结果
-- 再次查看所有 borrow_book 函数版本，确保只有一个
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'borrow_book'
  AND n.nspname = 'public';

-- =====================================================
-- 完成！
-- =====================================================
-- 执行此脚本后，应该只有一个 borrow_book 函数：
-- borrow_book(p_book_id uuid, p_user_id uuid, p_days integer DEFAULT 30)
-- =====================================================
