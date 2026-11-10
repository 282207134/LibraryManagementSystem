-- Inventory triggers captured from the existing project, before the approval migration.
CREATE OR REPLACE FUNCTION public.recalculate_available_on_quantity_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_borrowed_count INTEGER;
  v_new_available INTEGER;
BEGIN
  -- 如果quantity发生变化，重新计算available_quantity
  IF TG_OP = 'UPDATE' AND OLD.quantity IS DISTINCT FROM NEW.quantity THEN
    -- 计算当前借出的数量
    SELECT COUNT(*) INTO v_borrowed_count
    FROM borrowing_records
    WHERE book_id = NEW.id
      AND status IN ('borrowed', 'overdue');

    -- 计算新的可借数量
    v_new_available := NEW.quantity - COALESCE(v_borrowed_count, 0);

    -- 确保在有效范围内
    IF v_new_available < 0 THEN
      v_new_available := 0;
    END IF;

    IF v_new_available > NEW.quantity THEN
      v_new_available := NEW.quantity;
    END IF;

    -- 设置新的available_quantity
    NEW.available_quantity := v_new_available;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_book_available_quantity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_book_id UUID;
  v_quantity INTEGER;
  v_borrowed_count INTEGER;
  v_new_available INTEGER;
BEGIN
  -- 确定受影响的book_id
  IF TG_OP = 'DELETE' THEN
    v_book_id := OLD.book_id;
  ELSE
    v_book_id := NEW.book_id;
  END IF;

  -- 获取图书的总数量
  SELECT quantity INTO v_quantity
  FROM books
  WHERE id = v_book_id;

  IF v_quantity IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 计算当前借出的数量（只统计borrowed和overdue状态）
  SELECT COUNT(*) INTO v_borrowed_count
  FROM borrowing_records
  WHERE book_id = v_book_id
    AND status IN ('borrowed', 'overdue');

  -- 计算新的可借数量
  v_new_available := v_quantity - COALESCE(v_borrowed_count, 0);

  -- 确保在有效范围内
  IF v_new_available < 0 THEN
    v_new_available := 0;
  END IF;

  IF v_new_available > v_quantity THEN
    v_new_available := v_quantity;
  END IF;

  -- 更新图书的available_quantity
  UPDATE books
  SET available_quantity = v_new_available
  WHERE id = v_book_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER trigger_recalculate_on_quantity_change BEFORE UPDATE ON public.books FOR EACH ROW WHEN ((old.quantity IS DISTINCT FROM new.quantity)) EXECUTE FUNCTION recalculate_available_on_quantity_change();
CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_available_on_borrow_delete AFTER DELETE ON public.borrowing_records FOR EACH ROW WHEN (((old.status)::text = ANY ((ARRAY['borrowed'::character varying, 'overdue'::character varying])::text[]))) EXECUTE FUNCTION update_book_available_quantity();
CREATE TRIGGER trigger_update_available_on_borrow_insert AFTER INSERT ON public.borrowing_records FOR EACH ROW WHEN (((new.status)::text = ANY ((ARRAY['borrowed'::character varying, 'overdue'::character varying])::text[]))) EXECUTE FUNCTION update_book_available_quantity();
CREATE TRIGGER trigger_update_available_on_borrow_update AFTER UPDATE ON public.borrowing_records FOR EACH ROW WHEN ((((old.status)::text IS DISTINCT FROM (new.status)::text) AND (((new.status)::text = ANY ((ARRAY['borrowed'::character varying, 'overdue'::character varying, 'returned'::character varying])::text[])) OR ((old.status)::text = ANY ((ARRAY['borrowed'::character varying, 'overdue'::character varying])::text[]))))) EXECUTE FUNCTION update_book_available_quantity();
CREATE TRIGGER update_borrowing_records_updated_at BEFORE UPDATE ON public.borrowing_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
